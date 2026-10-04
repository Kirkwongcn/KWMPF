# 圖表式配置的讀取

決定及原因見 ADR 0013。程式：`packages/coverage/src/fact-sheet-chart-read.ts`（核對）、
`build-chart-allocations.ts`（產生）、`fact-sheet-chart-merge.ts`（合併）、
`scripts/ocr-chart-region.py`（兩次讀取）。

## 做法

```bash
# 一次性安裝（Debian／Ubuntu）
apt-get install tesseract-ocr tesseract-ocr-chi-tra
python3 -m venv .venv-ocr && .venv-ocr/bin/pip install -r requirements-chart-read.txt

# 讀圖：每個計劃一個 --pdf；--discover 印出每張圖兩次讀取的原始結果，對圖用
bun packages/coverage/src/build-chart-allocations.ts \
  --pdf "Sun Life Rainbow MPF Scheme=<dir>/SunLife_Rainbow.pdf" \
  --pdf "Manulife Global Select (MPF) Scheme=<dir>/Manulife_GlobalSelect.pdf" \
  --pdf "My Choice Mandatory Provident Fund Scheme=<dir>/MyChoice.pdf" \
  --python .venv-ocr/bin/python \
  --output data/sources/<date>/fund-fact-sheet-chart-allocations.json

# 合併入披露檔
bun packages/coverage/src/build-fact-sheet-allocation-report.ts ... \
  --chart-allocations data/sources/<date>/fund-fact-sheet-chart-allocations.json
```

## 契約（`allocation.chartRead`）

- `region`：圖表範圍，左右絕對、上下相對配置標題；`stopAt` 下一個標題頂住下界。
- `cropToImage`：圖表係嵌入圖像而且位置浮動（宏利），按 `pdftohtml` 列出的圖像位置裁。
- `valuesLeft`：Tesseract 另讀數值的欄界；`"axis"` 即係條形圖軸線右邊（宏利）。
- `secondRead: "text-layer"`：標註本身係文字（我的強積金），第二次讀取用便覽文字層。
- `wrap`：冇數值的圖例行屬邊個數值——`below` 接上一行、`nearest` 接中線最近嗰個。
- `splitGap`：同一條基線上左右兩個標註的最少空隙。
- `vocabulary`：逐張對圖抄錄的圖例（`chartLabels([[中文, 英文], …])`）。英文大細楷、空格照
  原文；英文一樣、中文唔同的分開列，由 RapidOCR 讀到的中文分。

## 新一期便覽

1. 用 `--discover` 重跑，睇每張被拒絕的原因。
2. 「matches no vocabulary entry」：渲染裁圖對圖，原文真係新圖例就加入清單；辨識程式拼錯
   （「Utilies」）就由佢拒絕，唔好為遷就錯字加入清單。
3. 「differs」：兩次讀取唔一致，照舊 `chart-only`，唔好改 Tesseract 參數去遷就。
4. 抽查通過的圖（每個計劃至少三張）同渲染圖逐個數字對過，先提交。
5. 重跑一次，輸出（除 `generatedAt`）要一字不差。
