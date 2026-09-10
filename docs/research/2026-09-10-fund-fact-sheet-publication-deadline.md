# 基金便覽的法定發布期限（issue #192）

## 結論

《強積金投資基金披露守則》（Code on Disclosure for MPF Investment Funds）第 D3 部分規定，
受託人每個財政期須向計劃成員發出**至少兩份**基金便覽（Fund Fact Sheet），匯報日分別是：

1. **計劃財政期終結日**本身 —— 須連同週年權益報表（Annual Benefit Statement）一併發出，
   即財政期終結後**三個月內**（D3.3，引用《強積金計劃規例》第 56(1) 條權益報表期限）。
2. **財政期終結後六個月**嗰日 —— 須喺該匯報日起**兩個月內**以合理方式（郵寄、僱主轉發、
   電郵、網站、傳真或客戶中心）分發（D3.4）。

即係話：

- 第一份便覽：財政期終結日 + 3 個月 = 法定期限。
- 第二份便覽：財政期終結日 + 6 個月 + 2 個月 = 財政期終結日 + 8 個月 = 法定期限。

兩份便覽披露內容一致（持倉、資產配置、風險指標、FER 等），只係匯報日唔同。

## 來源

- 積金局官網〈Disclosure of Information〉：
  "At least two FFSs will be issued by trustees to scheme members for each financial period:
  one reporting as at the end of the financial period and the other as at a date six months
  after the end of that financial period. The former is provided along with annual benefit
  statement (i.e. within three months after the end of the financial period of the scheme)
  and the latter distributed within two months from a date, which is six months after the
  end of the financial period of the scheme."
  <https://www.mpfa.org.hk/en/mpf-investment/investment-regulations-and-disclosure/disclosure-of-information>
- 積金局《強積金投資基金披露守則》正式文本（PDF，2025 年 4 月版）D3.1–D3.4：
  "the reporting date for the fund fact sheets should be as at the end of the financial period
  of the relevant scheme and a date which is six months after the end of the financial period
  of the relevant scheme"；"D3.3 The fund fact sheet that reports as at the end of the financial
  period of a scheme should be provided to members with the annual benefit statement under
  section 56(1) of the Regulation."；"D3.4 The other fund fact sheet does not need to be posted
  to members, but should be distributed within two months of the reporting date..."
  <https://www.mpfa.org.hk/en/mpf-system/background/-/media/13c146c96894402eaa660205e1ae9ae6.ashx>

## 平台欄位核實

MPFA 基金平台（`mfp.mpfa.org.hk`）逐隻基金詳情頁有獨立欄位 **Financial Period End Date**，
glossary 定義為「The last day of the financial period of the MPF scheme」，格式係月日
（例如 `30 Nov`），不帶年份，逐年重複。抽樣 `cf_id=102`（2026-09-10 抓取）：

```
Financial Period End Date: 30 Nov
Fund size (HKD Million): 21,939.61 (as at 31 August 2026)
```

留意風險級別、基金風險指標、FER、各項收費喺呢個平台頁面**冇獨立嘅「as at」日期**——
平台只喺 Fund size 及回報列帶「as at」，是平台每月更新嘅快照日，不等同任何一份便覽自己
嘅匯報日。所以呢個實作**唔會**假設 `dataAsOf` 精準對得上財政期終結日或終結後六個月嗰日；
而係倒推「以 `dataAsOf` 嗰刻計，最近一次已經到期嘅匯報日係邊一份（財政期終結日定終結後
六個月），套用嗰份嘅法定期限（3 個月或 2 個月）」，再加規格寫嘅 30 日寬限期，得出逐個
基金類別自己嘅過期日／寬限日數。呢個做法喺 `financialPeriodEndDate` 缺席時（例如未換版
嘅舊快照）退回原有嘅保守預設值，唔會報錯。

## 對實作的影響

`packages/coverage/src/data-freshness.ts` 嘅 `fundOverviewGraceDaysFor()` 按上述兩個匯報日
及對應嘅 3／2 個月法定期限計算，唔再用 PR #188 嗰個同月度週期睇齊嘅 45 日權宜值。
兩個計劃財政年結日唔同，喺同一日就會有唔同嘅寬限日數（91 至 120 日之間，視乎 `dataAsOf`
落喺財政年度入面邊一段），對應 issue #192 要求嘅「不同財政年結日的基金在同一日會有不同的
過期狀態」。
