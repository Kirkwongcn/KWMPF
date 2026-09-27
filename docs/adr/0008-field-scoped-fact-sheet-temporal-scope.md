# ADR 0008: Field-scoped factsheet dates and periods

Date: 2026-09-27
Status: accepted

## Context

A factsheet can contain several temporal scopes. Its document date may differ from a FER financial year, a commentary date, or the end of a risk indicator's lookback window. A single `factSheetAsOf` value cannot safely describe every disclosed field.

Official samples reviewed for DATA-08:

- AIA MPF Prime Value Choice, May 2026: the document date is 2026-05-31. The Top Ten Holdings heading explicitly repeats `As at 31 May 2026`; FER is for the financial year ended 2025-11-30; and the risk indicator uses monthly returns over the prior three years. The asset-allocation block has no separate date label in this sample, so its date remains absent.
- [Fidelity Retirement Master Trust World Bond Fund, July 2026](https://www.fidelityinternational.com/legal/documents/HK-zh_en/hffs.HK-zh_en.HK.H-CFWB.pdf): document date 2026-07-31; FER is labelled Year 2025; the Fund Commentary footnote is as of 2026-06-30; the risk indicator is annualised standard deviation of monthly returns over the prior three years to the reporting date.

## Decision

- Keep `factSheetAsOf` as the date associated with the factsheet document selector.
- Store additional dates and periods in `temporalScopes`, keyed by field (`allocation`, `topHoldings`, `fer`, `riskIndicator`, `commentary`).
- Represent a point date, a financial period, and a lookback window as different tagged shapes.
- Populate a field scope only when the official document states it and the parser can associate it with that field. Never copy the document date into another field by default.
- Keep a missing field scope absent. Do not infer FER dates or risk-window endpoints from a report date.

## Consequences

The parser records the selected factsheet date under the document scope. Allocation mapping carries a date only from the allocation scope, and the UI labels field dates only when present. AIA Prime Value Choice extracts the Top Ten Holdings date only when the field heading and its date occur together on the same reconstructed line. The Fidelity trustee contract extracts FER's labelled financial year, the commentary footnote date only when its marker is paired with the Fund Commentary heading, and the three-year risk lookback only when the note ties it to the reporting date. Other source contracts remain follow-up work.
