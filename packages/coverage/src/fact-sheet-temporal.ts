/** A source-backed date or calculation period for one factsheet field. */
export type FactSheetTemporalScope =
  | {
      kind: "point-in-time";
      asOf: string;
      sourceLabel?: string;
      page?: number;
    }
  | {
      kind: "financial-period";
      label: string;
      periodStart?: string;
      periodEnd?: string;
    }
  | {
      kind: "lookback-period";
      months: number;
      endingAt?: string;
      method?: string;
    };

export type FactSheetTemporalField =
  | "document"
  | "allocation"
  | "topHoldings"
  | "fer"
  | "riskIndicator"
  | "commentary";

export type FactSheetTemporalScopes = Partial<
  Record<FactSheetTemporalField, FactSheetTemporalScope>
>;

export function pointInTimeAsOf(
  scope: FactSheetTemporalScope | undefined,
): string | undefined {
  return scope?.kind === "point-in-time" ? scope.asOf : undefined;
}
