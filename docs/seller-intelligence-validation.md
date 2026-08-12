# Seller Intelligence completion report

Generated: 2026-08-12T02:48:16.746Z

Seller Intelligence aggregates real Cook County and Illinois property-transfer records by seller. Recorded consideration is not net cash received. A manager, president, executive, attorney, or registered agent does not establish ownership or personal proceeds.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Total seller entities | 9,133 |
| Unresolved sellers | 7,061 |
| Resolved seller entities | 2,072 |
| Confirmed/reported owners | 2,074 |
| Managers/officers found | 20 |
| $5M+ unresolved | 1,957 |
| $10M+ unresolved | 1,050 |
| $25M+ unresolved | 433 |
| $50M+ unresolved | 197 |
| $100M+ unresolved | 71 |
| Multiple-disposition sellers | 998 |
| Business exit candidates | 1,598 |
| Possible Exit Activity | 2,800 |
| Strong Exit Signals | 66 |
| High Exit Convergence | 0 |
| Recorded dispositions | $63.16B |
| People in Motion additions | 906 |

No Strong or High Exit records are manufactured to satisfy counts.

## Automatic sources refreshed

The four-hour workflow incrementally refreshes the sources below, using persisted watermarks, overlap windows, retries, idempotent normalization, and source-level failure isolation. A source with no upstream change exits without replacing the snapshot.

| Source | Status | Watermark | Last successful sync | Error |
| --- | --- | --- | --- | --- |
| SEC EDGAR transactions | LIVE | — | 2026-08-11T10:10:45.973Z | — |
| HSR early-termination notices | LIVE | — | 2026-08-11T10:10:45.973Z | — |
| GDELT transaction news | LIVE | 2026-08-12T02:50:36.734Z | 2026-08-12T02:50:36.734Z | — |
| CMS change of ownership | LIVE | — | 2026-08-12T02:50:36.327Z | — |
| FCC Universal Licensing System | LIVE | 2026-08-05 | 2026-08-12T02:50:36.327Z | — |
| USPTO patent assignments | DEGRADED | 2026-08-10T05:06:01.000Z | 2026-08-10T09:52:25.979Z | USPTO ODP daily file exceeds the 25000000-byte safety limit |
| STB rail transaction dockets | LIVE | 2026-08-12T02:50:36.327Z | 2026-08-12T02:50:36.327Z | — |
| Bankruptcy asset-sale dockets | LIVE | — | 2026-08-12T02:50:36.327Z | — |
| DOJ and FTC transaction notices | LIVE | 2026-08-12 | 2026-08-12T02:50:36.327Z | — |
| Chicago Property transactions | LIVE | 2026-08-07 | 2026-08-12T02:48:16.746Z | — |
| Cook County parcel sales | LIVE | 2026-08-01T12:06:13.000Z | 2026-08-12T02:48:16.746Z | — |
| Illinois PTAX-203 transfer declarations | LIVE | 2026-08-10T11:01:45.000Z | 2026-08-12T02:48:16.746Z | — |
| Cook County and Chicago transfer forms | LIVE | 2026-08-10T11:00:54.000Z | 2026-08-12T02:48:16.746Z | — |
| Cook County parcel situs addresses | LIVE | 2026-08-01T12:05:18.000Z | 2026-08-12T02:48:16.746Z | — |
| Cook County commercial valuation | LIVE | 2025-12-30T00:08:33.000Z | 2026-08-12T02:48:16.746Z | — |
| Cook County parcel geography | LIVE | 2026-08-01T14:23:21.000Z | 2026-08-12T02:48:16.746Z | — |
| Chicago business licenses | LIVE | 2026-08-11T19:35:09.000Z | 2026-08-12T02:48:16.746Z | — |
| Chicago business owners | LIVE | 2026-08-11T09:52:01.000Z | 2026-08-12T02:48:16.746Z | — |

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
