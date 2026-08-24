const PLACEHOLDERS = new Set(["n.a.", "n/a", "na", "-", "—"]);

export function fundClassLabel(name: string | undefined | null): string | null {
  const trimmed = (name ?? "").trim();
  if (trimmed === "") return null;
  return PLACEHOLDERS.has(trimmed.toLowerCase()) ? null : trimmed;
}

export function joinFundParts(...parts: (string | undefined | null)[]): string {
  return parts
    .map((part) => (part ?? "").trim())
    .filter((part) => part !== "")
    .join(" · ");
}
