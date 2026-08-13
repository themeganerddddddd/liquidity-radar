# Money in Motion validation report

Generated: 2026-08-13T03:06:27.633Z

## Outcome

- 17,009 deduplicated transaction signals
- 6,144 named people in the person-first view
- 13,377 private-company events
- 184 pre-close signals
- 11,465 known or reported transaction values
- 732 evidence-linked personal liquidity estimates
- 732 high-confidence estimates
- 100.0% of supported estimates include SEC evidence

- SEC remains 100.0% of supported estimates; the <50% target is not met because non-SEC sources do not yet provide enough transaction-value plus ownership evidence.
- 732 supported estimates are available; the 2,000 target is not met and no lower-confidence or synthetic estimates were added.

## Source business-value scorecard

| Source | State | Accepted | Clusters | People | Ownership | Values | Estimates | Pre-close | Median lead days |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SEC EDGAR transactions | LIVE | 1,482 | 1,478 | 1,475 | 732 | 1,477 | 732 | 49 | 0 |
| HSR early-termination notices | LIVE | 100 | 100 | 0 | 0 | 0 | 0 | 100 | — |
| GDELT transaction news | DEGRADED | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| CMS change of ownership | LIVE | 5,556 | 3,253 | 1,732 | 527 | 0 | 0 | 0 | — |
| FCC Universal Licensing System | LIVE | 27 | 26 | 0 | 0 | 0 | 0 | 26 | — |
| USPTO patent assignments | LIVE | 2,500 | 2,154 | 2,057 | 2,154 | 0 | 0 | 0 | — |
| FERC transaction dockets | IMPORT_ONLY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| STB rail transaction dockets | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Bankruptcy asset-sale dockets | LIVE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| DOJ and FTC transaction notices | LIVE | 9 | 9 | 0 | 0 | 0 | 0 | 9 | — |
| Chicago Property transactions | LIVE | 10,536 | 9,988 | 882 | 0 | 9,988 | 0 | 0 | 0 |
| Cook County parcel sales | LIVE | 8,380 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Illinois PTAX-203 transfer declarations | LIVE | 12,398 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Cook County and Chicago transfer forms | LIVE | 2,793 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Cook County parcel situs addresses | LIVE | 8,433 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Cook County commercial valuation | LIVE | 10,618 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Cook County parcel geography | LIVE | 8,435 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Chicago business licenses | LIVE | 22 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Chicago business owners | LIVE | 22 | 0 | 0 | 0 | 0 | 0 | 0 | — |
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
