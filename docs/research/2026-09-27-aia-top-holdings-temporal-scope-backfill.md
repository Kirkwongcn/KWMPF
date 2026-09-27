# AIA Prime Value Choice top-holdings date backfill (2026-09-27)

## Source review

Official source: [AIA MPF - Prime Value Choice Fund Performance Review, May 2026](https://www.aia.com.hk/content/dam/hk-wise/pdf/form-library/form-and-guides/employer/forms/aia-mpf-prime-value-choice-fund-performance-review-may-2026.pdf).

The PDF labels each of the 21 corresponding fund sections' Top Ten Holdings block with the point-in-time date “As at 31 May 2026”. The current disclosure artifact contains 21 records for `AIA_PrimeValueChoice.pdf`; each has ten extracted holdings and document date `2026-05-31`. This supports a field-level `topHoldings` scope for those records.

## Change boundary

- Add `temporalScopes.topHoldings = { kind: "point-in-time", asOf: "2026-05-31" }` to those 21 disclosure records.
- Keep the extracted holdings, percentages, source URL, source label, fund mappings, allocation data and all other values unchanged.
- Do not copy the document date to allocation or other fields; this backfill only records the date printed beside the Top Ten Holdings heading.
- Update `generatedAt` to reflect this artifact regeneration.

## Validation

- Before update, the source artifact contained 381 disclosures and no `temporalScopes`.
- The backfill targets exactly 21 records with the AIA official factsheet URL, `AIA_PrimeValueChoice.pdf`, `factSheetAsOf: 2026-05-31`, and ten extracted holdings.
- CI publication-seed validation is required before merge. This data-only change does not deploy or publish the production site.
