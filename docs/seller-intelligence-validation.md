# Seller Intelligence completion report

Generated: 2026-10-25T19:10:57.982Z

Seller Intelligence aggregates real Cook County, DuPage County, and Illinois property-transfer records by seller. Cross-county dispositions use the same seller identity key. Recorded consideration is not net cash received. A manager, president, executive, attorney, or registered agent does not establish ownership or personal proceeds.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Total seller entities | 11,514 |
| Unresolved sellers | 9,005 |
| Resolved seller entities | 2,509 |
| Confirmed/reported owners | 2,511 |
| Managers/officers found | 22 |
| $5M+ unresolved | 2,605 |
| $10M+ unresolved | 1,394 |
| $25M+ unresolved | 585 |
| $50M+ unresolved | 266 |
| $100M+ unresolved | 91 |
| Multiple-disposition sellers | 1,147 |
| Business exit candidates | 1,838 |
| Possible Exit Activity | 3,344 |
| Strong Exit Signals | 76 |
| High Exit Convergence | 0 |
| Recorded dispositions | $84.34B |
| People in Motion additions | 1,042 |
| Cross-county sellers | 54 |
| Cross-county recorded value | $1.49B |

No Strong or High Exit records are manufactured to satisfy counts.

## Automatic sources refreshed

The four-hour workflow incrementally refreshes the sources below, using persisted watermarks, overlap windows, retries, idempotent normalization, and source-level failure isolation. A source with no upstream change exits without replacing the snapshot.

| Source | Status | Watermark | Last successful sync | Error |
| --- | --- | --- | --- | --- |
| SEC EDGAR transactions | LIVE | — | 2026-10-25T13:43:29.595Z | — |
| HSR early-termination notices | LIVE | — | 2026-10-25T13:43:29.595Z | — |
| GDELT transaction news | DEGRADED | 2026-08-20T08:55:03.057Z | 2026-10-16T22:53:11.784Z | GDELT RATE_LIMITED: Please limit requests to one every 5 seconds or contact kalev.leetaru5@gmail.com for larger queries. All high-traffic users should switch to our ngrams dataset: https://blog.gdeltproject.org/using-the-new-web-ngrams-dataset-to-find-relevant-coverage/. For trend analysis, please see our daily newsletter briefings: https |
| CMS change of ownership | LIVE | — | 2026-10-25T19:09:44.101Z | — |
| FCC Universal Licensing System | LIVE | 2026-10-25 | 2026-10-25T19:09:44.101Z | — |
| USPTO patent assignments | DEGRADED | 2026-08-12T05:12:17.000Z | 2026-08-12T21:09:23.491Z | USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED:180357611 |
| STB rail transaction dockets | LIVE | 2026-10-25T19:09:44.101Z | 2026-10-25T19:09:44.101Z | — |
| Bankruptcy asset-sale dockets | LIVE | — | 2026-10-25T19:09:44.101Z | — |
| DOJ and FTC transaction notices | LIVE | 2026-10-25 | 2026-10-25T19:09:44.101Z | — |
| Chicago Property transactions | LIVE | 2026-10-16 | 2026-10-25T19:06:29.197Z | — |
| Cook County parcel sales | LIVE | 2026-10-15T11:56:49.000Z | 2026-10-25T19:06:29.197Z | — |
| Illinois PTAX-203 transfer declarations | LIVE | 2026-10-18T11:00:55.000Z | 2026-10-25T19:06:29.197Z | — |
| Cook County and Chicago transfer forms | LIVE | 2026-10-18T11:00:29.000Z | 2026-10-25T19:06:29.197Z | — |
| Cook County parcel situs addresses | LIVE | 2026-10-15T11:55:56.000Z | 2026-10-25T19:06:29.197Z | — |
| Cook County commercial valuation | LIVE | 2025-12-30T00:08:33.000Z | 2026-10-25T19:06:29.197Z | — |
| Cook County parcel geography | LIVE | 2026-10-15T15:02:43.000Z | 2026-10-25T19:06:29.197Z | — |
| Chicago business licenses | LIVE | 2026-10-24T09:53:08.000Z | 2026-10-25T19:06:29.197Z | — |
| Chicago business owners | LIVE | 2026-10-24T09:47:34.000Z | 2026-10-25T19:06:29.197Z | — |

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
