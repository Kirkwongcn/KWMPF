export type ComparisonGroupSource = "lipper" | "platform";

export type ComparisonGroup = {
  name: string;
  source: ComparisonGroupSource;
};

export const PLATFORM_GROUP_PREFIX = "平台分類：";

export type ClassifiableFundClass = {
  lipperCategory?: string;
  fundType?: string;
  fundCategory?: string;
};

/**
 * Lipper 分類是同類比較的主口徑。少數基金所屬計劃不在 Lipper 來源內
 * （現時只有 SHKP MPF Employer Sponsored Scheme），改以平台分類自成一組，
 * 並加上前綴，避免與同名的 Lipper 分類（例如 Guaranteed Fund）混為一組。
 */
export function comparisonGroupFor(
  fundClass: ClassifiableFundClass,
): ComparisonGroup {
  const lipper = fundClass.lipperCategory?.trim();
  if (lipper) return { name: lipper, source: "lipper" };

  const platform =
    fundClass.fundType?.trim() || fundClass.fundCategory?.trim() || "未分類";
  return { name: `${PLATFORM_GROUP_PREFIX}${platform}`, source: "platform" };
}

export function comparisonGroupSourceOf(name: string): ComparisonGroupSource {
  return name.startsWith(PLATFORM_GROUP_PREFIX) ? "platform" : "lipper";
}

export type Classification = {
  provider: string;
  dataset: string;
  capturedAt: string;
  official: boolean;
};

/**
 * 分類來自非官方的 Lipper 資料集，顯示時必須連同提供者及期別，
 * 不可與官方平台數據混為一談。
 */
export function classificationOf(publication?: {
  classification?: Classification;
}): Classification | null {
  return publication?.classification ?? null;
}
