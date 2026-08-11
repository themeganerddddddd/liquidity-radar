# Chicago Property validation report

Generated: 2026-08-11T19:24:28.261Z

This report reflects only the production snapshot built from official public records. Recorded consideration is not net cash received, and no person-level proceeds are generated without supported ownership.

## Completion metrics

| Metric                                             |                        Result |
| -------------------------------------------------- | ----------------------------: |
| Coverage                                           | 2022-01-03 through 2026-08-07 |
| Significant transactions                           |                        11,621 |
| Commercial transactions                            |                         8,889 |
| Large residential transactions                     |                         2,732 |
| Recorded transaction value                         |                       $69.85B |
| PTAX matches                                       |                        10,374 |
| Business-license matches                           |                           135 |
| Business-owner matches                             |                            56 |
| Person-resolved transactions                       |                         2,247 |
| Organization-only transactions                     |                         9,374 |
| License cancellations near sale                    |                             6 |
| Other business-exit matches                        |                             6 |
| Strong exit convergence                            |                             0 |
| High exit convergence                              |                             0 |
| People in Motion person-level events added         |                           906 |
| Capital directory organization/person events added |                         8,889 |
| Duplicate source rows removed/clustered            |                        31,556 |
| Non-market transfers excluded                      |                         5,056 |
| Cook/PTAX material value discrepancies             |                             0 |

## Live source health

| Source                                  | Status | Rows fetched this run | Matched records | Watermark                | Error |
| --------------------------------------- | ------ | --------------------: | --------------: | ------------------------ | ----- |
| Cook County parcel sales                | LIVE   |                     0 |           8,380 | 2026-08-01T12:06:13.000Z | —     |
| Illinois PTAX-203 transfer declarations | LIVE   |                     0 |          10,374 | 2026-08-10T11:01:45.000Z | —     |
| Cook County and Chicago transfer forms  | LIVE   |                     0 |           2,793 | 2026-08-10T11:00:54.000Z | —     |
| Cook County parcel situs addresses      | LIVE   |                     0 |           8,433 | 2026-08-01T12:05:18.000Z | —     |
| Cook County commercial valuation        | LIVE   |                     0 |          10,618 | 2025-12-30T00:08:33.000Z | —     |
| Cook County parcel geography            | LIVE   |                     0 |           8,435 | 2026-08-01T14:23:21.000Z | —     |
| Chicago business licenses               | LIVE   |                     0 |              22 | 2026-08-06T10:05:13.000Z | —     |
| Chicago business owners                 | LIVE   |                     0 |              22 | 2026-08-11T09:52:01.000Z | —     |

## Property-type distribution

| Property type      | Transactions |
| ------------------ | -----------: |
| OFFICE             |          612 |
| RETAIL             |        1,543 |
| INDUSTRIAL         |        1,143 |
| HOTEL              |          139 |
| MULTIFAMILY        |        3,239 |
| MIXED_USE          |          576 |
| LAND               |          600 |
| SELF_STORAGE       |           30 |
| HEALTHCARE         |          235 |
| OTHER_COMMERCIAL   |          772 |
| RESIDENTIAL_LUXURY |        2,732 |
| UNKNOWN            |            0 |

## Value distribution

| Recorded value | Transactions |
| -------------- | -----------: |
| $1M-$5M        |        9,330 |
| $5M-$10M       |        1,083 |
| $10M-$25M      |          741 |
| $25M-$50M      |          252 |
| $50M-$100M     |          148 |
| $100M+         |           67 |
| Unknown        |            0 |

## Exit-convergence distribution

| Label                  | Transactions |
| ---------------------- | -----------: |
| Asset Sale Only        |       11,605 |
| Possible Exit Activity |           16 |
| Strong Exit Signals    |            0 |
| High Exit Convergence  |            0 |

## Requested real-record examples

### Commercial sales with a resolved person

- **Lisa H Cox** — Multifamily sale; $1.26M recorded consideration; CHICAGO, Illinois; 2026-08-05; 1 parcel; exit convergence 20. [Official record](https://data.illinois.gov/d/it54-y4c6) (document 2621716101).
- **Andrew J Pacini** — Multifamily sale; $1.10M recorded consideration; CHICAGO, Illinois; 2026-08-05; 1 parcel; exit convergence 20. [Official record](https://data.illinois.gov/d/it54-y4c6) (document 2621710050).
- **Steven Olivieri** — Multifamily sale; $1.25M recorded consideration; CHICAGO, Illinois; 2026-08-04; 1 parcel; exit convergence 20. [Official record](https://data.illinois.gov/d/it54-y4c6) (document 2621629056).

### Commercial sales with an unresolved seller entity

- **CHICAGO INDUSTRIAL LL, LLC** — Industrial sale; $14.95M recorded consideration; CHICAGO, Illinois; 2026-08-07; 1 parcel; exit convergence 20. [Official record](https://data.illinois.gov/d/it54-y4c6) (document 2621927020).
- **CHICAGO INDUSTRIAL LL, LLC** — Industrial sale; $8.33M recorded consideration; SOUTH HOLLAND, Illinois; 2026-08-07; 2 parcels; exit convergence 20. [Official record](https://data.illinois.gov/d/it54-y4c6) (document 2621927023).

### Strong business-exit convergence

- No production record currently meets this exact criterion.

_Real-record shortfall: 2. The pipeline does not fabricate examples or lower the qualification threshold._

### Portfolio sale

- **CHICAGO INDUSTRIAL LL, LLC** — Industrial sale; $7.65M recorded consideration; SCHAUMBURG, Illinois; 2026-08-07; 2 parcels; exit convergence 20. [Official record](https://data.illinois.gov/d/it54-y4c6) (document 2621927021).

### Large-home-only signal

- **Kaled Awada** — Large residential sale; $2.50M recorded consideration; GLENVIEW, Illinois; 2026-08-07; 2 parcels; exit convergence 5. [Official record](https://data.illinois.gov/d/it54-y4c6) (document 2621923268).

### Large-home plus separate business-exit evidence

- **Jaehyuk Choi** — Large residential sale; $2.15M recorded consideration; WILMETTE, Illinois; 2026-06-29; 1 parcel; exit convergence 10. [Official record](https://data.illinois.gov/d/it54-y4c6) (document 2618002193).

## Product safeguards verified

- Multi-parcel source rows are clustered by document/transaction and counted once.
- Cook recorded price and PTAX full, net, and taxable consideration remain separate fields.
- Quitclaim, trust, nominal, related-party, reorganization, and distress transfers are excluded from high-confidence liquidity results.
- Exact account/legal/DBA/normalized-entity methods may auto-resolve; fuzzy candidates do not.
- Business-owner percentages remain unknown unless explicitly reported.
- Property situs locations are shown; owner mailing addresses are neither collected nor surfaced.
- Sale consideration, gross attributable value, potential proceeds, and net proceeds are distinct; unknown values remain unknown.
