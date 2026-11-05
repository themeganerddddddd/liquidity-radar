# Seller Intelligence completion report

Generated: 2026-11-05T01:01:14.234Z

Seller Intelligence aggregates real Cook County, DuPage County, and Illinois property-transfer records by seller. Cross-county dispositions use the same seller identity key. Recorded consideration is not net cash received. A manager, president, executive, attorney, or registered agent does not establish ownership or personal proceeds.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Total seller entities | 11,635 |
| Unresolved sellers | 9,100 |
| Resolved seller entities | 2,535 |
| Confirmed/reported owners | 2,537 |
| Managers/officers found | 22 |
| $5M+ unresolved | 2,631 |
| $10M+ unresolved | 1,411 |
| $25M+ unresolved | 588 |
| $50M+ unresolved | 268 |
| $100M+ unresolved | 91 |
| Multiple-disposition sellers | 1,148 |
| Business exit candidates | 1,844 |
| Possible Exit Activity | 3,371 |
| Strong Exit Signals | 76 |
| High Exit Convergence | 0 |
| Recorded dispositions | $85.01B |
| People in Motion additions | 1,047 |
| Cross-county sellers | 54 |
| Cross-county recorded value | $1.49B |

No Strong or High Exit records are manufactured to satisfy counts.

## Automatic sources refreshed

The four-hour workflow incrementally refreshes the sources below, using persisted watermarks, overlap windows, retries, idempotent normalization, and source-level failure isolation. A source with no upstream change exits without replacing the snapshot.

| Source | Status | Watermark | Last successful sync | Error |
| --- | --- | --- | --- | --- |
| SEC EDGAR transactions | LIVE | — | 2026-11-04T17:14:06.886Z | — |
| HSR early-termination notices | LIVE | — | 2026-11-04T17:14:06.886Z | — |
| GDELT transaction news | DEGRADED | 2026-08-22T08:55:03.057Z | 2026-11-03T12:04:39.026Z | GDELT RATE_LIMITED: Please limit requests to one every 5 seconds or contact kalev.leetaru5@gmail.com for larger queries. All high-traffic users should switch to our ngrams dataset: https://blog.gdeltproject.org/using-the-new-web-ngrams-dataset-to-find-relevant-coverage/. For trend analysis, please see our daily newsletter briefings: https |
| CMS change of ownership | LIVE | — | 2026-11-05T00:59:45.526Z | — |
| FCC Universal Licensing System | LIVE | 2026-10-29 | 2026-11-05T00:59:45.526Z | — |
| USPTO patent assignments | DEGRADED | 2026-08-12T05:12:17.000Z | 2026-08-12T21:09:23.491Z | USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED:180357611 |
| STB rail transaction dockets | LIVE | 2026-11-05T00:59:45.526Z | 2026-11-05T00:59:45.526Z | — |
| Bankruptcy asset-sale dockets | DEGRADED | — | — | CourtListener search returned 401 |
| DOJ and FTC transaction notices | LIVE | 2026-11-05 | 2026-11-05T00:59:45.526Z | — |
| Chicago Property transactions | LIVE | 2026-10-30 | 2026-11-05T00:56:33.718Z | — |
| Cook County parcel sales | LIVE | 2026-11-01T12:35:19.000Z | 2026-11-05T00:56:33.718Z | — |
| Illinois PTAX-203 transfer declarations | LIVE | 2026-11-01T12:02:05.000Z | 2026-11-05T00:56:33.718Z | — |
| Cook County and Chicago transfer forms | LIVE | 2026-11-01T12:00:37.000Z | 2026-11-05T00:56:33.718Z | — |
| Cook County parcel situs addresses | LIVE | 2026-11-01T12:33:40.000Z | 2026-11-05T00:56:33.718Z | — |
| Cook County commercial valuation | LIVE | 2025-12-30T00:08:33.000Z | 2026-11-05T00:56:33.718Z | — |
| Cook County parcel geography | LIVE | 2026-11-01T16:33:33.000Z | 2026-11-05T00:56:33.718Z | — |
| Chicago business licenses | LIVE | 2026-11-04T23:25:54.000Z | 2026-11-05T00:56:33.718Z | — |
| Chicago business owners | LIVE | 2026-11-04T10:51:36.000Z | 2026-11-05T00:56:33.718Z | — |

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
