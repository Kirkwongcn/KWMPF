# ADR 0008: Field-scoped factsheet dates and periods

Date: 2026-09-27
Status: accepted

## Context

A factsheet can contain several temporal scopes. Its document date may differ from a FER financial year, a commentary date, or the end of a risk indicator's lookback window. A single `factSheetAsOf` value cannot safely describe every disclosed field.

Official samples reviewed for DATA-08:

- AIA MPF Prime Value Choice, May 2026: document/allocation date 2026-05-31; FER is for the financial year ended 2025-11-30; the risk indicator uses monthly returns over the prior three years.
- Fidelity Retirement Master Trust World Bond Fund, July 2026: document date 2026-07-31; FER is labelled Year 2025; commentary is as of 2026-06-30; the risk indicator is a three-year standard deviation.

## Decision

- Keep `factSheetAsOf` as the date associated with the factsheet document selector.
- Store additional dates and periods in `temporalScopes`, keyed by field (`allocation`, `topHoldings`, `fer`, `riskIndicator`, `commentary`).
- Represent a point date, a financial period, and a lookback window as different tagged shapes.
- Populate a field scope only when the official document states it and the parser can associate it with that field. Never copy the document date into another field by default.
- Keep a missing field scope absent. Do not infer FER dates or risk-window endpoints from a report date.

## Consequences

The parser records the selected factsheet date under the document scope. Allocation mapping carries a date only from the allocation scope, and the UI labels field dates only when present. The parser does not yet extract independent dates for every field; source-specific extraction and sample verification remain follow-up work.
