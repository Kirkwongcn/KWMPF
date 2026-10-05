import {
  COMPARE_LIMIT,
  CompareItem,
  clearCompareItems,
  compareHref,
  removeCompareItem,
  toggleCompareItem,
  useCompareItems,
} from "./compareStore";

/** 每行基金旁邊的「加入比較」掣；已滿四隻時停用未選的基金。 */
export function CompareToggle({
  item,
  compact = false,
}: {
  item: CompareItem;
  compact?: boolean;
}) {
  const items = useCompareItems();
  const selected = items.some((entry) => entry.id === item.id);
  const full = !selected && items.length >= COMPARE_LIMIT;
  return (
    <button
      type="button"
      className={`kw-compare-toggle${selected ? " is-selected" : ""}${compact ? " kw-compare-toggle--compact" : ""}`}
      aria-pressed={selected}
      disabled={full}
      title={full ? `最多比較 ${COMPARE_LIMIT} 隻基金` : undefined}
      aria-label={`${selected ? "從比較移除" : "加入比較"}：${item.label}`}
      onClick={() => toggleCompareItem(item)}
    >
      <span aria-hidden="true">{selected ? "✓" : "+"}</span>
      {!compact && <span>{selected ? "已加入比較" : "加入比較"}</span>}
    </button>
  );
}

/** 頁底比較欄：喺任何頁面揀咗基金，都可以一撳去並列比較。 */
export function CompareTray() {
  const items = useCompareItems();
  if (items.length === 0 || window.location.pathname === "/funds/compare")
    return null;
  const groups = new Set(items.map((item) => item.group ?? ""));
  return (
    <aside className="kw-tray" aria-label="比較清單">
      <div className="kw-shell kw-tray__inner">
        <p className="kw-tray__count">
          <strong>
            已選 {items.length}/{COMPARE_LIMIT}
          </strong>
          {groups.size > 1 && (
            <span className="kw-tray__note">不同基金類型，只作並列</span>
          )}
        </p>
        <ul className="kw-tray__items">
          {items.map((item) => (
            <li key={item.id}>
              <span className="kw-tray__label">{item.label}</span>
              <button
                type="button"
                className="kw-tray__remove"
                aria-label={`從比較移除：${item.label}`}
                onClick={() => removeCompareItem(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="kw-tray__actions">
          <button
            type="button"
            className="kw-button kw-button--ghost"
            onClick={clearCompareItems}
          >
            清除
          </button>
          <a className="kw-button" href={compareHref(items)}>
            並列比較
          </a>
        </div>
      </div>
    </aside>
  );
}
