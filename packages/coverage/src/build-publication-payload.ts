import { buildPublicationPreflight } from "./publication-preflight";

export type PublicationRecord = Parameters<typeof buildPublicationPreflight>[0][number];

export function buildPublicationPayload(records: PublicationRecord[]) {
  const preflight = buildPublicationPreflight(records);
  if (!preflight.ready) {
    return {
      ready: false as const,
      preflight,
      records: [],
    };
  }

  return {
    ready: true as const,
    preflight,
    records,
  };
}
