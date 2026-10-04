import { useState } from "react";

/** 便覽官方文字欄位（ADR 0012）：原文照錄，中英各一份，唔由本站翻譯補齊。 */
export type NarrativeText = { heading: string; zh?: string; en?: string };

export type FundNarrativeFields = Partial<
  Record<
    | "investmentObjective"
    | "managerCommentary"
    | "marketForecast"
    | "investmentManager",
    NarrativeText
  >
>;

const COLLAPSE_AFTER = 2;

function daysBetween(from: string, to: Date) {
  const start = Date.parse(`${from}T00:00:00Z`);
  if (Number.isNaN(start)) return undefined;
  return Math.floor((to.getTime() - start) / 86_400_000);
}

/** 項目符號開頭的段落以清單顯示；符號本身係版面記號，唔重覆印出。 */
function Paragraphs({ text, limit }: { text: string; limit?: number }) {
  const paragraphs = text.split("\n").filter((line) => line.trim() !== "");
  const shown = limit === undefined ? paragraphs : paragraphs.slice(0, limit);
  const bulleted = shown.every((line) => /^[•●▪■◆]/.test(line));
  if (bulleted) {
    return (
      <ul className="kw-narrative__list">
        {shown.map((line, index) => (
          <li key={index}>{line.replace(/^[•●▪■◆]\s*/, "")}</li>
        ))}
      </ul>
    );
  }
  return (
    <>
      {shown.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </>
  );
}

export function NarrativeBlock({
  id,
  title,
  text,
  missing,
  source,
  date,
  today = new Date(),
  collapsible = false,
}: {
  id: string;
  title: string;
  text?: NarrativeText;
  /** 冇文字時顯示的說明（官方未提供、疊印、或本站未抽取）。 */
  missing: string;
  source?: { url?: string; label: string };
  /** 這段文字自己的日期；`label` 寫明係評論日期定便覽日期。 */
  date?: { asOf: string; label: string };
  today?: Date;
  collapsible?: boolean;
}) {
  const languages = (["zh", "en"] as const).filter((key) => text?.[key]);
  const [language, setLanguage] = useState<"zh" | "en">(languages[0] ?? "zh");
  const [expanded, setExpanded] = useState(false);
  const body = text?.[language] ?? text?.[languages[0] ?? "zh"];
  const paragraphCount = body?.split("\n").filter(Boolean).length ?? 0;
  const collapsed = collapsible && !expanded && paragraphCount > COLLAPSE_AFTER;
  const age = date ? daysBetween(date.asOf, today) : undefined;
  return (
    <section className="kw-section kw-narrative" aria-labelledby={id}>
      <h2 className="kw-section__heading" id={id}>
        {title}
      </h2>
      {body ? (
        <div className="kw-narrative__sheet">
          <div className="kw-narrative__meta">
            <p>
              受託人便覽原文，本站未改寫
              {date && (
                <>
                  {" · "}
                  {date.label} {date.asOf}
                  {age !== undefined && age >= 0 ? `（距今 ${age} 日）` : ""}
                </>
              )}
              {source?.url && (
                <>
                  {" · "}
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.label}
                  </a>
                </>
              )}
            </p>
            {languages.length > 1 && (
              <div
                className="kw-segmented"
                role="group"
                aria-label={`${title}語文`}
              >
                <button
                  type="button"
                  aria-pressed={language === "zh"}
                  onClick={() => setLanguage("zh")}
                >
                  中文
                </button>
                <button
                  type="button"
                  aria-pressed={language === "en"}
                  onClick={() => setLanguage("en")}
                  lang="en"
                >
                  English
                </button>
              </div>
            )}
          </div>
          <div
            className="kw-narrative__body"
            lang={language === "en" ? "en" : "zh-HK"}
          >
            <Paragraphs
              text={body}
              limit={collapsed ? COLLAPSE_AFTER : undefined}
            />
          </div>
          {collapsible && paragraphCount > COLLAPSE_AFTER && (
            <button
              type="button"
              className="kw-narrative__more"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "收起" : `展開全文（共 ${paragraphCount} 段）`}
            </button>
          )}
          <p className="kw-narrative__heading-note">
            便覽標題：{text?.heading}
          </p>
        </div>
      ) : (
        <p className="kw-status">{missing}</p>
      )}
    </section>
  );
}
