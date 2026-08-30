/**
 * `pdftohtml -xml` 的座標抽取。
 *
 * 便覽的配置及持倉是多欄雙語版面，`pdftotext -layout` 會把相鄰欄位的文字併到同一行
 * （例如滙豐那份的配置數字與市場評論），無法定位表格。座標輸出保留每段文字的
 * `top` / `left` / 字體，才能按欄位還原表格。
 */

export type PdfTextItem = {
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  text: string;
};

export type PdfPage = {
  number: number;
  width: number;
  height: number;
  items: PdfTextItem[];
};

type FontSpec = { size: number; family: string; color: string };

const PAGE_OPEN =
  /<page number="(\d+)"[^>]*height="(\d+)"\s+width="(\d+)"[^>]*>/;
const FONT_SPEC =
  /<fontspec id="(\d+)"\s+size="(-?\d+)"\s+family="([^"]*)"\s+color="([^"]*)"\s*\/>/g;
const TEXT =
  /<text\s+top="(-?\d+)"\s+left="(-?\d+)"\s+width="(-?\d+)"\s+height="(-?\d+)"\s+font="(\d+)"[^>]*>([\s\S]*?)<\/text>/g;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

function decode(value: string) {
  return value
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function parsePdfXml(xml: string): PdfPage[] {
  const pages: PdfPage[] = [];
  // poppler 的 fontspec id 在整份文件內遞增，但只在首次出現的頁面宣告，所以要跨頁累積。
  const fonts = new Map<number, FontSpec>();

  for (const chunk of xml.split(/(?=<page number=")/)) {
    const header = chunk.match(PAGE_OPEN);
    if (!header?.[1] || !header[2] || !header[3]) continue;

    for (const spec of chunk.matchAll(FONT_SPEC)) {
      fonts.set(Number(spec[1]), {
        size: Number(spec[2]),
        family: spec[3] ?? "",
        color: spec[4] ?? "",
      });
    }

    const number = Number(header[1]);
    const items: PdfTextItem[] = [];
    for (const match of chunk.matchAll(TEXT)) {
      const text = decode(match[6] ?? "");
      if (text === "") continue;
      const font = fonts.get(Number(match[5]));
      items.push({
        page: number,
        top: Number(match[1]),
        left: Number(match[2]),
        width: Number(match[3]),
        height: Number(match[4]),
        fontSize: font?.size ?? 0,
        fontFamily: font?.family ?? "",
        fontColor: font?.color ?? "",
        text,
      });
    }

    pages.push({
      number,
      height: Number(header[2]),
      width: Number(header[3]),
      items: items.sort((a, b) => a.top - b.top || a.left - b.left),
    });
  }

  if (pages.length === 0) throw new Error("pdftohtml XML has no pages");
  return pages;
}

/** 文件順序（頁 → top → left）的全部文字段落。 */
export function documentOrder(pages: PdfPage[]): PdfTextItem[] {
  return pages
    .flatMap((page) => page.items)
    .sort(
      (a, b) => a.page - b.page || a.top - b.top || a.left - b.left,
    );
}

/**
 * 把同一行的文字段落接成一句。中銀保誠那份把 `8.4%` 拆成 `8` `.` `4` `%` 四段，
 * 一律加空格會變成 `8 . 4 %`，等於改寫原文；所以只有兩段之間真係有水平空隙先加空格，
 * 緊貼的直接接埋。
 */
export function joinItems(items: PdfTextItem[], gap = 1) {
  let text = "";
  let right: number | undefined;
  for (const item of items) {
    if (right !== undefined) text += item.left - right > gap ? " " : "";
    text += item.text;
    right = item.left + item.width;
  }
  return text;
}

export type PdfLine = {
  page: number;
  top: number;
  items: PdfTextItem[];
  text: string;
};

/**
 * 把同一頁內 `top` 相近的段落併成一行。便覽的雙語表格經常把英文名、中文名及百分比
 * 分成三段文字，只有併行之後才看得出「標籤 + 百分比」的結構。
 */
export function toLines(page: PdfPage, tolerance = 4): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const item of [...page.items].sort(
    (a, b) => a.top - b.top || a.left - b.left,
  )) {
    const line = lines.find((current) => Math.abs(current.top - item.top) <= tolerance);
    if (line) line.items.push(item);
    else lines.push({ page: page.number, top: item.top, items: [item], text: "" });
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.left - b.left);
    line.text = joinItems(line.items);
  }
  return lines.sort((a, b) => a.top - b.top);
}
