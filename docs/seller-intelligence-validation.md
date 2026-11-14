# Seller Intelligence completion report

Generated: 2026-11-14T15:15:34.157Z

Seller Intelligence aggregates real Cook County, DuPage County, and Illinois property-transfer records by seller. Cross-county dispositions use the same seller identity key. Recorded consideration is not net cash received. A manager, president, executive, attorney, or registered agent does not establish ownership or personal proceeds.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Total seller entities | 11,694 |
| Unresolved sellers | 9,143 |
| Resolved seller entities | 2,551 |
| Confirmed/reported owners | 2,553 |
| Managers/officers found | 22 |
| $5M+ unresolved | 2,648 |
| $10M+ unresolved | 1,422 |
| $25M+ unresolved | 592 |
| $50M+ unresolved | 271 |
| $100M+ unresolved | 91 |
| Multiple-disposition sellers | 1,150 |
| Business exit candidates | 1,849 |
| Possible Exit Activity | 3,389 |
| Strong Exit Signals | 76 |
| High Exit Convergence | 0 |
| Recorded dispositions | $85.50B |
| People in Motion additions | 1,050 |
| Cross-county sellers | 56 |
| Cross-county recorded value | $1.50B |

No Strong or High Exit records are manufactured to satisfy counts.

## Automatic sources refreshed

The four-hour workflow incrementally refreshes the sources below, using persisted watermarks, overlap windows, retries, idempotent normalization, and source-level failure isolation. A source with no upstream change exits without replacing the snapshot.

| Source | Status | Watermark | Last successful sync | Error |
| --- | --- | --- | --- | --- |
| SEC EDGAR transactions | LIVE | — | 2026-11-13T17:12:41.586Z | — |
| HSR early-termination notices | LIVE | — | 2026-11-13T17:12:41.586Z | — |
| GDELT transaction news | DEGRADED | 2026-08-22T08:55:03.057Z | 2026-11-08T20:36:55.284Z | GDELT CONNECT_TIMEOUT: fetch failed: ConnectTimeoutError: Connect Timeout Error (attempted address: api.gdeltproject.org:443, timeout: 10000ms) |
| CMS change of ownership | LIVE | — | 2026-11-14T15:14:21.527Z | — |
| FCC Universal Licensing System | LIVE | 2026-11-07 | 2026-11-14T15:14:21.527Z | — |
| USPTO patent assignments | LIVE | 2026-08-22T05:06:01.000Z | 2026-11-14T15:14:21.527Z | — |
| STB rail transaction dockets | LIVE | 2026-11-14T15:14:21.527Z | 2026-11-14T15:14:21.527Z | — |
| Bankruptcy asset-sale dockets | DEGRADED | — | — | CourtListener search returned 401 |
| DOJ and FTC transaction notices | LIVE | 2026-11-14 | 2026-11-14T15:14:21.527Z | — |
| Chicago Property transactions | LIVE | 2026-11-06 | 2026-11-14T15:10:49.193Z | — |
| Cook County parcel sales | LIVE | 2026-11-01T12:35:19.000Z | 2026-11-14T15:10:49.193Z | — |
| Illinois PTAX-203 transfer declarations | LIVE | 2026-11-08T12:01:45.000Z | 2026-11-14T15:10:49.193Z | — |
| Cook County and Chicago transfer forms | LIVE | 2026-11-08T12:00:28.000Z | 2026-11-14T15:10:49.193Z | — |
| Cook County parcel situs addresses | LIVE | 2026-11-01T12:33:40.000Z | 2026-11-14T15:10:49.193Z | — |
| Cook County commercial valuation | LIVE | 2025-12-30T00:08:33.000Z | 2026-11-14T15:10:49.193Z | — |
| Cook County parcel geography | LIVE | 2026-11-01T16:33:33.000Z | 2026-11-14T15:10:49.193Z | — |
| Chicago business licenses | LIVE | 2026-11-14T11:08:16.000Z | 2026-11-14T15:10:49.193Z | — |
| Chicago business owners | LIVE | 2026-11-14T10:49:20.000Z | 2026-11-14T15:10:49.193Z | — |

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
