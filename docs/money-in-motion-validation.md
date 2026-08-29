# Money in Motion validation report

Generated: 2026-08-29T22:41:31.513Z

## Outcome

- 8,197 deduplicated transaction signals
- 5,773 named people in the person-first view
- 4,565 private-company events
- 178 pre-close signals
- 1,477 known or reported transaction values
- 732 evidence-linked personal liquidity estimates
- 732 high-confidence estimates
- 100.0% of supported estimates include SEC evidence

- SEC remains 100.0% of supported estimates; the <50% target is not met because non-SEC sources do not yet provide enough transaction-value plus ownership evidence.
- 732 supported estimates are available; the 2,000 target is not met and no lower-confidence or synthetic estimates were added.

## Source business-value scorecard

| Source | State | Accepted | Clusters | People | Ownership | Values | Estimates | Pre-close | Median lead days |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SEC EDGAR transactions | LIVE | 1,482 | 1,478 | 1,475 | 732 | 1,477 | 732 | 44 | 0 |
| HSR early-termination notices | LIVE | 100 | 100 | 0 | 0 | 0 | 0 | 100 | — |
| GDELT transaction news | DEGRADED | 23 | 19 | 0 | 0 | 0 | 0 | 13 | 0 |
| CMS change of ownership | LIVE | 7,501 | 4,425 | 2,243 | 701 | 0 | 0 | 0 | — |
| FCC Universal Licensing System | LIVE | 11 | 10 | 0 | 0 | 0 | 0 | 10 | — |
| USPTO patent assignments | DEGRADED | 2,500 | 2,154 | 2,057 | 2,154 | 0 | 0 | 0 | — |
| FERC transaction dockets | IMPORT_ONLY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| STB rail transaction dockets | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Bankruptcy asset-sale dockets | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| DOJ and FTC transaction notices | LIVE | 11 | 11 | 0 | 0 | 0 | 0 | 11 | — |
| Chicago Property transactions | DEGRADED | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Cook County parcel sales | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Illinois PTAX-203 transfer declarations | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Cook County and Chicago transfer forms | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Cook County parcel situs addresses | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Cook County commercial valuation | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Cook County parcel geography | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Chicago business licenses | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Chicago business owners | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Maryland business registry | IMPORT_ONLY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| District of Columbia business registry | IMPORT_ONLY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Virginia business registry | IMPORT_ONLY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Commercial-property closings | IMPORT_ONLY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Broker and business-for-sale feeds | IMPORT_ONLY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |

## Integrity checks

- Personal estimate without ownership evidence: 0
- Named person inferred from GDELT news: 0
- Duplicate source-event assignment across clusters: 0
- Confidence outside 0–100: 0
- Actionability outside 0–100: 0

## Evidence boundaries

- CMS owner records add named people only when the official all-owners dataset supplies a name. A personal liquidity estimate is not produced without transaction consideration.
- GDELT supplies discovery and timing evidence. A headline never creates a named-person estimate, and syndicated exact-title copies count once for corroboration.
- STB case-status records remain pending-regulatory until completion evidence is available.
- USPTO is LIVE when `USPTO_API_KEY` is configured: current ODP PASDL daily ZIP files are processed through bounded disk and XML streams. Name changes, corrections, security interests, liens, licenses, internal reorganizations, and unknown conveyances are excluded. No cash consideration is inferred.
- FCC, FERC, state registries, commercial property, and broker feeds remain import-only until a documented public or licensed machine-readable feed is configured.
- No residential address is used for lead generation.
