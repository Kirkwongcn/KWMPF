import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { factSheetPages } from "./build-fact-sheet-allocation-report";
import { allocationHeadings } from "./fact-sheet-allocation";
import { factSheetContract } from "./fact-sheet-allocation-contracts";
import {
  readChartAllocation,
  type ChartAllocationFile,
  type ChartAllocationRecord,
  type ChartReadResult,
  type OcrOutput,
} from "./fact-sheet-chart-read";

/**
 * `coverage:chart-allocations`：讀圖表式配置（ADR 0013），輸出一份待覆核的 JSON，
 * 放喺來源批次目錄，`coverage:fact-sheet-allocation-report --chart-allocations` 再按
 * 檔案 SHA-256 合併。OCR 只喺呢一步跑；發布流程只讀已覆核的結果。
 *
 * 需要 `pdftoppm`、`tesseract`（chi_tra+eng）及 Python `rapidocr-onnxruntime`
 * （見 `requirements-chart-read.txt`）。
 *
 * 用法：bun packages/coverage/src/build-chart-allocations.ts \
 *   --pdf "Sun Life Rainbow MPF Scheme=path/to/SunLife_Rainbow.pdf" [--pdf ...] \
 *   --output data/sources/<date>/fund-fact-sheet-chart-allocations.json \
 *   [--python path/to/python] [--discover]
 */

const run = promisify(execFile);
const DPI = 300;
const OCR_SCRIPT = join(import.meta.dirname, "..", "..", "..", "scripts", "ocr-chart-region.py");

type ImageBox = { left: number; top: number; width: number; height: number };

/** 一頁嵌入圖像的位置（`pdftohtml -xml` 唔加 `-i` 先會列出 `<image>`）。 */
async function pageImages(pdf: string, page: number, work: string): Promise<ImageBox[]> {
  const prefix = join(work, `images-${page}`);
  await run("pdftohtml", ["-xml", "-f", String(page), "-l", String(page), pdf, prefix]);
  const xml = await readFile(`${prefix}.xml`, "utf8");
  await rm(prefix, { recursive: true, force: true });
  return [...xml.matchAll(/<image top="(-?\d+)" left="(-?\d+)" width="(\d+)" height="(\d+)"/g)].map(
    (match) => ({
      top: Number(match[1]),
      left: Number(match[2]),
      width: Number(match[3]),
      height: Number(match[4]),
    }),
  );
}

function argValues(args: string[], name: string) {
  return args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]!] : []));
}

async function main() {
  const args = process.argv.slice(2);
  const pdfs = argValues(args, "--pdf").map((pair) => {
    const at = pair.lastIndexOf("=");
    return { scheme: pair.slice(0, at), path: pair.slice(at + 1) };
  });
  const output = argValues(args, "--output")[0];
  const python = argValues(args, "--python")[0] ?? "python3";
  const discover = args.includes("--discover");
  if (pdfs.length === 0 || (!output && !discover)) {
    throw new Error("usage: --pdf 'Scheme=path.pdf' ... --output file.json [--python bin] [--discover]");
  }

  const work = await mkdtemp(join(tmpdir(), "chart-read-"));
  const funds: ChartAllocationRecord[] = [];
  for (const { scheme, path } of pdfs) {
    const contract = factSheetContract(scheme, "trustee");
    const spec = contract.allocation.chartRead;
    if (!spec) throw new Error(`${scheme}: contract has no allocation.chartRead`);
    const sourceSha256 = createHash("sha256").update(await readFile(path)).digest("hex");
    const pages = await factSheetPages(path);
    const rendered = new Map<number, string>();
    for (const found of allocationHeadings(pages, contract)) {
      const base = {
        schemeName: scheme,
        constituentFundName: found.constituentFundName,
        ...(found.fundClassName ? { fundClassName: found.fundClassName } : {}),
        factSheetFile: basename(path),
        sourceSha256,
      };
      if ("reason" in found) {
        funds.push({ ...base, status: "rejected", reason: found.reason });
        continue;
      }
      const heading = found.heading;
      const page = pages.find((candidate) => candidate.number === heading.page)!;
      let image = rendered.get(page.number);
      if (!image) {
        const prefix = join(work, `${basename(path)}-${page.number}`);
        await run("pdftoppm", ["-r", String(DPI), "-f", String(page.number), "-l", String(page.number), "-png", "-singlefile", path, prefix]);
        image = `${prefix}.png`;
        rendered.set(page.number, image);
      }
      const window = {
        left: spec.region.minLeft,
        right: spec.region.maxLeft,
        top: heading.top + spec.region.top,
        bottom: Math.min(heading.top + spec.region.bottom, found.stopTop ?? Number.POSITIVE_INFINITY),
      };
      let region = window;
      if (spec.cropToImage) {
        const inWindow = (await pageImages(path, page.number, work)).filter(
          (box) =>
            box.top >= window.top - spec.cropToImage!.pad &&
            box.top < window.bottom &&
            box.left + box.width / 2 >= window.left &&
            box.left + box.width / 2 <= window.right,
        );
        const distinct = inWindow.filter(
          (box, index) =>
            inWindow.findIndex(
              (other) => Math.abs(other.top - box.top) <= 2 && Math.abs(other.left - box.left) <= 2,
            ) === index,
        );
        if (distinct.length !== 1) {
          funds.push({ ...base, page: page.number, status: "rejected", reason: `${distinct.length} chart images under the heading` });
          continue;
        }
        const box = distinct[0]!;
        const pad = spec.cropToImage.pad;
        region = {
          left: box.left - pad,
          right: box.left + box.width + pad,
          top: box.top - pad,
          bottom: box.top + box.height + pad,
        };
      }
      // 用渲染圖的實際闊度求出比例（PNG 檔頭 16–19 位元組），同一份 PDF 每頁可能唔同大細。
      const scale = (await readFile(image)).readUInt32BE(16) / page.width;
      const ocr = JSON.parse(
        (
          await run(
            python,
            [
              OCR_SCRIPT,
              image,
              String(Math.floor(region.left * scale)),
              String(Math.floor(region.top * scale)),
              String(Math.ceil(region.right * scale)),
              String(Math.ceil(region.bottom * scale)),
              ...(spec.valuesLeft === undefined
                ? []
                : [spec.valuesLeft === "axis" ? "axis" : String(Math.floor(spec.valuesLeft * scale))]),
            ],
            { maxBuffer: 64 * 1024 * 1024 },
          )
        ).stdout,
      ) as OcrOutput & { engines: Record<string, string> };
      const reads =
        spec.secondRead === "text-layer"
          ? [ocr.engines.rapidocr!, "fact sheet text layer (pdftohtml -xml)"]
          : [ocr.engines.rapidocr!, ocr.engines.tesseract!];
      if (spec.secondRead === "text-layer") {
        // 文字層座標換成裁圖像素，同 RapidOCR 用同一個座標系分行。
        const originLeft = Math.floor(region.left * scale);
        const originTop = Math.floor(region.top * scale);
        ocr.textLayer = page.items
          .filter(
            (item) =>
              item.text.trim() !== "" &&
              item.left >= region.left &&
              item.left + item.width <= region.right &&
              item.top >= region.top &&
              item.top + item.height <= region.bottom &&
              item.fontSize >= (spec.textLayerMinFontSize ?? 0),
          )
          .map((item) => ({
            text: item.text.trim(),
            left: item.left * scale - originLeft,
            top: item.top * scale - originTop,
            right: (item.left + item.width) * scale - originLeft,
            bottom: (item.top + item.height) * scale - originTop,
          }));
      }
      if (discover) {
        console.log(`\n## ${scheme} | ${found.constituentFundName} | p${page.number}`);
        for (const box of ocr.rapidocr) console.log(`R ${Math.round(box.top)}\t${box.text}`);
        for (const line of ocr.tesseract) {
          console.log(`T ${Math.round(line.words[0]!.top)}\t${line.words.map((word) => word.text).join(" ")}`);
        }
      }
      const result: ChartReadResult = readChartAllocation(ocr, spec, scale);
      const label = contract.allocation.headingLabel
        ? contract.allocation.headingLabel(heading.text)
        : heading.text;
      funds.push({
        ...base,
        page: page.number,
        region,
        heading: label,
        ...(result.status === "ok" ? { ...result, reads } : result),
      });
      if (discover) console.log(result.status === "ok" ? `OK ${result.printed.join(" ")}` : `REJECTED ${result.reason}`);
    }
  }
  const file: ChartAllocationFile = {
    generatedAt: new Date().toISOString(),
    method: { renderer: `pdftoppm -r ${DPI}` },
    funds,
  };
  if (output) await writeFile(output, `${JSON.stringify(file, null, 2)}\n`);
  const accepted = funds.filter((fund) => fund.status === "ok").length;
  console.error(`chart allocations: ${accepted} accepted, ${funds.length - accepted} rejected`);
}

if (import.meta.main) await main();
