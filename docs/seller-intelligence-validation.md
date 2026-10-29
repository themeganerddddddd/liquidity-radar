# Seller Intelligence completion report

Generated: 2026-10-29T21:19:09.608Z

Seller Intelligence aggregates real Cook County, DuPage County, and Illinois property-transfer records by seller. Cross-county dispositions use the same seller identity key. Recorded consideration is not net cash received. A manager, president, executive, attorney, or registered agent does not establish ownership or personal proceeds.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Total seller entities | 11,582 |
| Unresolved sellers | 9,058 |
| Resolved seller entities | 2,524 |
| Confirmed/reported owners | 2,526 |
| Managers/officers found | 22 |
| $5M+ unresolved | 2,621 |
| $10M+ unresolved | 1,404 |
| $25M+ unresolved | 588 |
| $50M+ unresolved | 268 |
| $100M+ unresolved | 91 |
| Multiple-disposition sellers | 1,147 |
| Business exit candidates | 1,841 |
| Possible Exit Activity | 3,359 |
| Strong Exit Signals | 76 |
| High Exit Convergence | 0 |
| Recorded dispositions | $84.77B |
| People in Motion additions | 1,045 |
| Cross-county sellers | 54 |
| Cross-county recorded value | $1.49B |

No Strong or High Exit records are manufactured to satisfy counts.

## Automatic sources refreshed

The four-hour workflow incrementally refreshes the sources below, using persisted watermarks, overlap windows, retries, idempotent normalization, and source-level failure isolation. A source with no upstream change exits without replacing the snapshot.

| Source | Status | Watermark | Last successful sync | Error |
| --- | --- | --- | --- | --- |
| SEC EDGAR transactions | LIVE | — | 2026-10-29T16:06:52.621Z | — |
| HSR early-termination notices | LIVE | — | 2026-10-29T16:06:52.621Z | — |
| GDELT transaction news | DEGRADED | 2026-08-21T20:55:03.057Z | 2026-10-29T21:17:24.010Z | GDELT INVALID_CONTENT_TYPE_text_html_charset_utf_8: INVALID_CONTENT_TYPE_text/html; charset=utf-8 |
| CMS change of ownership | LIVE | — | 2026-10-29T21:17:23.359Z | — |
| FCC Universal Licensing System | LIVE | 2026-10-22 | 2026-10-29T21:17:23.359Z | — |
| USPTO patent assignments | DEGRADED | 2026-08-12T05:12:17.000Z | 2026-08-12T21:09:23.491Z | USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED:180357611 |
| STB rail transaction dockets | LIVE | 2026-10-29T21:17:23.359Z | 2026-10-29T21:17:23.359Z | — |
| Bankruptcy asset-sale dockets | DEGRADED | — | — | CourtListener search returned 405 |
| DOJ and FTC transaction notices | LIVE | 2026-10-29 | 2026-10-29T21:17:23.359Z | — |
| Chicago Property transactions | LIVE | 2026-10-23 | 2026-10-29T21:13:03.127Z | — |
| Cook County parcel sales | LIVE | 2026-10-15T11:56:49.000Z | 2026-10-29T21:13:03.127Z | — |
| Illinois PTAX-203 transfer declarations | LIVE | 2026-10-26T11:01:28.000Z | 2026-10-29T21:13:03.127Z | — |
| Cook County and Chicago transfer forms | LIVE | 2026-10-26T11:00:19.000Z | 2026-10-29T21:13:03.127Z | — |
| Cook County parcel situs addresses | LIVE | 2026-10-15T11:55:56.000Z | 2026-10-29T21:13:03.127Z | — |
| Cook County commercial valuation | LIVE | 2025-12-30T00:08:33.000Z | 2026-10-29T21:13:03.127Z | — |
| Cook County parcel geography | LIVE | 2026-10-15T15:02:43.000Z | 2026-10-29T21:13:03.127Z | — |
| Chicago business licenses | LIVE | 2026-10-29T09:56:52.000Z | 2026-10-29T21:13:03.127Z | — |
| Chicago business owners | LIVE | 2026-10-29T09:47:24.000Z | 2026-10-29T21:13:03.127Z | — |

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
