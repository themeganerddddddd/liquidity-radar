# Seller Intelligence completion report

Generated: 2026-10-10T23:38:29.877Z

Seller Intelligence aggregates real Cook County, DuPage County, and Illinois property-transfer records by seller. Cross-county dispositions use the same seller identity key. Recorded consideration is not net cash received. A manager, president, executive, attorney, or registered agent does not establish ownership or personal proceeds.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Total seller entities | 11,439 |
| Unresolved sellers | 8,944 |
| Resolved seller entities | 2,495 |
| Confirmed/reported owners | 2,497 |
| Managers/officers found | 21 |
| $5M+ unresolved | 2,585 |
| $10M+ unresolved | 1,382 |
| $25M+ unresolved | 581 |
| $50M+ unresolved | 263 |
| $100M+ unresolved | 89 |
| Multiple-disposition sellers | 1,143 |
| Business exit candidates | 1,835 |
| Possible Exit Activity | 3,330 |
| Strong Exit Signals | 75 |
| High Exit Convergence | 0 |
| Recorded dispositions | $83.28B |
| People in Motion additions | 1,040 |
| Cross-county sellers | 53 |
| Cross-county recorded value | $1.48B |

No Strong or High Exit records are manufactured to satisfy counts.

## Automatic sources refreshed

The four-hour workflow incrementally refreshes the sources below, using persisted watermarks, overlap windows, retries, idempotent normalization, and source-level failure isolation. A source with no upstream change exits without replacing the snapshot.

| Source | Status | Watermark | Last successful sync | Error |
| --- | --- | --- | --- | --- |
| SEC EDGAR transactions | LIVE | — | 2026-10-09T16:10:59.142Z | — |
| HSR early-termination notices | LIVE | — | 2026-10-09T16:10:59.142Z | — |
| GDELT transaction news | DEGRADED | 2026-08-19T08:55:03.057Z | 2026-10-10T14:34:44.231Z | GDELT RATE_LIMITED: Please limit requests to one every 5 seconds or contact kalev.leetaru5@gmail.com for larger queries. All high-traffic users should switch to our ngrams dataset: https://blog.gdeltproject.org/using-the-new-web-ngrams-dataset-to-find-relevant-coverage/. For trend analysis, please see our daily newsletter briefings: https |
| CMS change of ownership | LIVE | — | 2026-10-10T23:37:59.247Z | — |
| FCC Universal Licensing System | LIVE | 2026-10-03 | 2026-10-10T23:37:59.247Z | — |
| USPTO patent assignments | DEGRADED | 2026-08-12T05:12:17.000Z | 2026-08-12T21:09:23.491Z | USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED:180357611 |
| STB rail transaction dockets | LIVE | 2026-10-10T23:37:59.247Z | 2026-10-10T23:37:59.247Z | — |
| Bankruptcy asset-sale dockets | LIVE | — | 2026-10-10T23:37:59.247Z | — |
| DOJ and FTC transaction notices | LIVE | 2026-10-10 | 2026-10-10T23:37:59.247Z | — |
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
