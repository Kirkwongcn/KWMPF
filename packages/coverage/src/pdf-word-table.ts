import type { BboxWord } from "./pdf-xml";

/**
 * `pdftotext -bbox` 逐詞座標嘅共用工具：便覽表格按欄位讀（中銀保誠、交通銀行）。
 *
 * bbox 會把「13.79」拆成「13」「.」「79」幾個詞；2026 Q2 便覽量度所得，數字碎片相距 ≤ 0.6 pt，
 * 詞與詞之間 ≥ 1.75 pt，所以 1 pt 內、同一高度先併。
 */

export type Word = BboxWord & { yMid: number; xMid: number };

export const SAME_LINE = 2.5;
const FRAGMENT_GAP = 1.0;
const FRAGMENT_LINE = 1.5;
const COLUMN_MARGIN = 4;

export function withMid(word: BboxWord): Word {
  return { ...word, yMid: (word.yMin + word.yMax) / 2, xMid: (word.xMin + word.xMax) / 2 };
}

/** 按高度分行；同行與否對該行平均高度判斷，避免一個略高的左欄詞把同一行切開。 */
export function lines(words: Word[]) {
  const result: { yMid: number; words: Word[] }[] = [];
  for (const word of [...words].sort((a, b) => a.yMid - b.yMid || a.xMin - b.xMin)) {
    const line = result.at(-1);
    if (line && Math.abs(word.yMid - line.yMid) <= SAME_LINE) {
      line.words.push(word);
      line.yMid = line.words.reduce((sum, item) => sum + item.yMid, 0) / line.words.length;
    } else result.push({ yMid: word.yMid, words: [word] });
  }
  return result.map((line) => line.words.sort((a, b) => a.xMin - b.xMin));
}

/** 緊貼（相距不足一個空格、高度相同）的碎片併返做一個詞；高度跟第一塊，上標（「Fund^」）唔會拉郁成個詞。 */
export function mergeFragments(words: BboxWord[]): Word[] {
  const merged: Word[] = [];
  for (const word of [...words].map(withMid).sort((a, b) => a.xMin - b.xMin || a.yMid - b.yMid)) {
    const index = merged.findIndex(
      (item) => word.xMin - item.xMax >= -0.2 && word.xMin - item.xMax <= FRAGMENT_GAP && Math.abs(word.yMid - item.yMid) <= FRAGMENT_LINE,
    );
    if (index < 0) {
      merged.push(word);
      continue;
    }
    const item = merged[index]!;
    const xMax = Math.max(item.xMax, word.xMax);
    merged[index] = { ...item, text: item.text + word.text, xMax, xMid: (item.xMin + xMax) / 2 };
  }
  return merged;
}

export function centre(words: Word[]) {
  return (words[0]!.xMin + words.at(-1)!.xMax) / 2;
}

/** 「1」「Year」呢類數字加單位：單位左邊緊貼、同高度嘅數字。 */
export function labelled(words: Word[], number: string, unit: RegExp) {
  return words.flatMap((unitWord) => {
    if (!unit.test(unitWord.text)) return [];
    const numbers = words.filter(
      (word) => word.text === number && unitWord.xMin - word.xMax >= 0 && unitWord.xMin - word.xMax < 4 && Math.abs(unitWord.yMid - word.yMid) < 4,
    );
    return numbers.length === 1 ? [{ x: centre([numbers[0]!, unitWord]), y: unitWord.yMid }] : [];
  });
}

/** 一個詞屬於最近嘅欄（數值有時靠右、有時置中）；同兩欄距離太接近、或者離最近欄多過最窄欄距，就當讀唔到。 */
export function nearestColumn(word: Word, centres: number[]) {
  const ranked = centres.map((value, column) => ({ distance: Math.abs(value - word.xMid), column })).sort((a, b) => a.distance - b.distance);
  const [nearest, second] = ranked;
  const narrowest = Math.min(...centres.slice(1).map((value, index) => value - centres[index]!));
  if (!nearest || nearest.distance > narrowest || (second && second.distance - nearest.distance < COLUMN_MARGIN)) return undefined;
  return nearest.column;
}
