import type { CandidateAnomaly } from "./candidate-anomalies";

export type RefreshOutcome = "no_new_data" | "blocked" | "needs_review" | "ready";

export type RefreshReadiness = {
  ready: boolean;
  inputRecords: number;
  acceptedRecords: number;
  blockedRecords: number;
  missingByField: Record<string, number>;
};

export type RefreshAudit = {
  batchId: string;
  policyVersion: string;
  requiresReview: boolean;
  anomalies: CandidateAnomaly[];
  affectedFundClassIds: string[];
};

export type RefreshDecisionInput = {
  previousDataAsOf?: string;
  candidateDataAsOf: string;
  readiness: RefreshReadiness;
  audit: RefreshAudit;
};

export type RefreshDecision = {
  outcome: RefreshOutcome;
  previousDataAsOf?: string;
  candidateDataAsOf: string;
  publishable: boolean;
  reasons: string[];
};

export function decideRefresh(input: RefreshDecisionInput): RefreshDecision {
  const { previousDataAsOf, candidateDataAsOf, readiness, audit } = input;
  const base = { previousDataAsOf, candidateDataAsOf };
  if (previousDataAsOf === candidateDataAsOf) {
    return {
      ...base,
      outcome: "no_new_data",
      publishable: false,
      reasons: [`官方來源截至日期仍然是 ${candidateDataAsOf}，沒有新批次。`],
    };
  }
  if (!readiness.ready) {
    return {
      ...base,
      outcome: "blocked",
      publishable: false,
      reasons: [
        `${readiness.blockedRecords} 個基金類別未通過發布前檢查，候選批次不可發布。`,
        ...Object.entries(readiness.missingByField)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([field, count]) => `缺少 ${field} 的記錄：${count} 個。`),
      ],
    };
  }
  if (audit.requiresReview) {
    return {
      ...base,
      outcome: "needs_review",
      publishable: false,
      reasons: [
        `異常核對政策 ${audit.policyVersion} 標記了 ${audit.anomalies.length} 項異常，涉及 ${audit.affectedFundClassIds.length} 個基金類別；必須人手核對後才可發布。`,
        ...summarizeAnomalyKinds(audit.anomalies).map(
          ({ kind, count }) => `${anomalyLabel(kind)}：${count} 項。`,
        ),
      ],
    };
  }
  return {
    ...base,
    outcome: "ready",
    publishable: true,
    reasons: [
      `候選批次通過發布前檢查及異常核對，${readiness.acceptedRecords} 個基金類別可發布。`,
    ],
  };
}

const anomalyLabels: Record<CandidateAnomaly["kind"], string> = {
  identity_changed: "基金類別身份改變",
  same_date_value_revised: "同一截至日數值被修訂",
  large_monthly_return: "單月回報超過門檻",
  allocation_total_out_of_range: "配置合計超出範圍",
  fee_changed: "費率改變",
  source_failed_twice: "來源連續失敗",
};

function anomalyLabel(kind: CandidateAnomaly["kind"]) {
  return anomalyLabels[kind] ?? kind;
}

export function summarizeAnomalyKinds(anomalies: CandidateAnomaly[]) {
  const counts = new Map<CandidateAnomaly["kind"], number>();
  for (const anomaly of anomalies) {
    counts.set(anomaly.kind, (counts.get(anomaly.kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

const outcomeHeadings: Record<RefreshOutcome, string> = {
  no_new_data: "沒有新批次",
  blocked: "候選批次被發布前檢查阻擋",
  needs_review: "候選批次需要人手核對",
  ready: "候選批次已通過全部自動檢查",
};

export function renderRefreshSummary(
  decision: RefreshDecision,
  details: {
    readiness: RefreshReadiness;
    audit: RefreshAudit;
    snapshotPath: string;
    expectedCounts?: Record<string, number>;
    expectedCountsSource?: string;
  },
) {
  const { readiness, audit } = details;
  const lines = [
    `## ${outcomeHeadings[decision.outcome]}`,
    "",
    `- 官方來源截至日期：${decision.previousDataAsOf ?? "（無上一批次）"} → **${decision.candidateDataAsOf}**`,
    `- 候選快照：\`${details.snapshotPath}\``,
    `- 發布前檢查：${readiness.acceptedRecords} 個可發布 / ${readiness.inputRecords} 個輸入，${readiness.blockedRecords} 個被阻擋`,
    `- 異常核對（政策 ${audit.policyVersion}）：${audit.anomalies.length} 項異常，涉及 ${audit.affectedFundClassIds.length} 個基金類別`,
  ];
  if (details.expectedCounts) {
    const counts = Object.entries(details.expectedCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name} ${value}`)
      .join("、");
    lines.push(`- 獨立數量核對：${counts}`);
  }
  if (details.expectedCountsSource) {
    lines.push(`- 數量核對來源：${details.expectedCountsSource}`);
  }
  lines.push("", "### 判斷理由", "");
  for (const reason of decision.reasons) lines.push(`- ${reason}`);
  const kinds = summarizeAnomalyKinds(audit.anomalies);
  if (kinds.length > 0) {
    lines.push("", "### 異常分類", "", "| 類別 | 數量 |", "| --- | ---: |");
    for (const { kind, count } of kinds) {
      lines.push(`| ${anomalyLabel(kind)} | ${count} |`);
    }
  }
  lines.push(
    "",
    "### 下一步",
    "",
    decision.publishable
      ? "審批並合併此 PR，然後手動觸發 `Deploy production`，並在 `source_snapshot` 填入上述候選快照路徑。"
      : decision.outcome === "no_new_data"
        ? "官方來源未有新批次，不需要任何操作。"
        : "先核對上述異常或阻擋原因；未解釋清楚之前不要合併，也不要發布。",
    "",
    "公開網站在此 PR 合併後仍然不會改變；發布是獨立且需要明確批准的步驟。",
  );
  return `${lines.join("\n")}\n`;
}
