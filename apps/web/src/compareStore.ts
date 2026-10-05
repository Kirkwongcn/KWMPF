import { useEffect, useState } from "react";

// 比較清單只係瀏覽器內的便利功能：存喺 localStorage，讀寫失敗就當空清單，
// 頁面照常運作。清單只記基金 id 同顯示名稱，數值一律喺比較頁重新讀取。
export const COMPARE_LIMIT = 4;
const STORAGE_KEY = "kwmpf.compare.funds.v1";
const CHANGE_EVENT = "kwmpf:compare-change";

export type CompareItem = {
  id: string;
  label: string;
  /** 積金局基金類型；用嚟提示所選基金唔屬同一類型。 */
  group?: string;
};

function isCompareItem(value: unknown): value is CompareItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.label === "string" &&
    (item.group === undefined || typeof item.group === "string")
  );
}

export function readCompareItems(): CompareItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .filter(isCompareItem)
      .filter((item) => !seen.has(item.id) && seen.add(item.id))
      .slice(0, COMPARE_LIMIT);
  } catch {
    return [];
  }
}

export function writeCompareItems(items: CompareItem[]) {
  const next = items.slice(0, COMPARE_LIMIT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 私密瀏覽或封鎖儲存時，清單只喺今次頁面有效。
  }
  memory = next;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

let memory: CompareItem[] | null = null;

function currentItems() {
  const stored = readCompareItems();
  return stored.length > 0 || memory === null ? stored : memory;
}

export function toggleCompareItem(item: CompareItem) {
  const items = currentItems();
  if (items.some((entry) => entry.id === item.id)) {
    writeCompareItems(items.filter((entry) => entry.id !== item.id));
    return;
  }
  if (items.length >= COMPARE_LIMIT) return;
  writeCompareItems([...items, item]);
}

export function removeCompareItem(id: string) {
  writeCompareItems(currentItems().filter((entry) => entry.id !== id));
}

export function clearCompareItems() {
  writeCompareItems([]);
}

export function compareHref(items: { id: string }[]) {
  return `/funds/compare?ids=${items.map((item) => encodeURIComponent(item.id)).join(",")}`;
}

export function useCompareItems(): CompareItem[] {
  const [items, setItems] = useState<CompareItem[]>(currentItems);
  useEffect(() => {
    const refresh = () => setItems(currentItems());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return items;
}
