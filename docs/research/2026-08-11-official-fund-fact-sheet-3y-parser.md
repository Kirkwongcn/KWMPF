# 官方基金便覽 3 年回報解析研究

日期：2026-08-11

## 結論

積金局官方基金便覽包含基金表現的 1、3、5、10 年及成立至今年度回報。樣本 `MT00571.pdf` 為文字型 PDF，可在 GitHub Actions 以文字抽取方式處理；暫不需要 OCR。基金便覽以成分基金為主要披露單位，因此解析器只產生成分基金層面的 3 年回報補充紀錄，不把成分基金數值自動複製到基金類別。

## 已鎖定規則

- 保留來源 URL 及文件截至日期。
- 只接受 PDF 明確列出的 3 年年度回報；不由 1、5 或 10 年數值推算。
- 缺少或無法解析 3 年數值時 fail-closed，該紀錄不進入發布快照。
- 先以文字型官方 PDF 建立 parser seam；掃描型 PDF 另行研究 OCR，不在本切片混入。
- 解析結果仍須與基金類別身份及受託人來源核對後，才可進入排名。

## 來源

- [BEA (MPF) Value Scheme Fund Fact Sheet, as of 30 September 2025](https://www.mpfa.org.hk/assets/FF/MT00571.pdf)
- [MPFA Repository of Scheme Documents](https://www.mpfa.org.hk/en/mpf-investment/investment-regulations-and-disclosure/repository-of-scheme-documents)
- [MPFA MPF Investment FAQ](https://www.mpfa.org.hk/en/info-centre/faq/mpf-investment/mpf-investment)
