export interface SystemHealthModel {
  discoveryPending: number;
  onboardingPending: number;
  materialsPending: number;
  recentCount: number;
  workspaceCount: number;
  gitRepoCount: number;
  writeConsistencyIssues?: Array<{
    label: string;
    detail: string;
  }>;
}

export function renderSystemHealth(parent: HTMLElement, model: SystemHealthModel): void {
  const issues = model.writeConsistencyIssues ?? [];
  const card = parent.createDiv({ cls: "ts-card ts-compact-card ts-system-health-card" });
  const head = card.createDiv({ cls: "ts-card-head" });
  head.createSpan({ cls: "ts-card-label", text: "数据健康" });
  head.createSpan({ cls: "ts-card-meta", text: systemStatus(model) });

  const grid = card.createDiv({ cls: "ts-system-health-grid" });
  metric(grid, String(model.discoveryPending), "候选");
  metric(grid, String(model.onboardingPending), "接入");
  metric(grid, String(model.materialsPending), "资料");
  metric(grid, String(issues.length), "写入");

  const issuePanel = card.createDiv({ cls: "ts-system-health-issue-panel" });
  const issueHead = issuePanel.createDiv({ cls: "ts-system-health-section-head" });
  issueHead.createDiv({ cls: "ts-system-health-section-title", text: "维护信号" });
  issueHead.createDiv({ cls: "ts-system-health-section-meta", text: issues.length > 0 ? `${issues.length} 条` : "暂无" });

  const list = issuePanel.createDiv({ cls: "ts-system-health-issues" });
  if (issues.length > 0) {
    for (const issue of issues.slice(0, 2)) {
      const row = list.createDiv({ cls: "ts-system-health-issue" });
      row.createDiv({ cls: "ts-system-health-issue-title", text: issue.label });
      row.createDiv({ cls: "ts-system-health-issue-detail", text: issue.detail });
    }
    if (issues.length > 2) {
      list.createDiv({ cls: "ts-system-health-more", text: `+${issues.length - 2} 条未显示` });
    }
  } else {
    list.createDiv({ cls: "ts-system-health-empty", text: "暂无维护信号" });
  }

  const context = card.createDiv({ cls: "ts-system-health-context" });
  contextChip(context, "最近", String(model.recentCount));
  contextChip(context, "工作区", String(model.workspaceCount));
  contextChip(context, "仓库", String(model.gitRepoCount));
}

function systemStatus(model: SystemHealthModel): string {
  const pending = model.discoveryPending + model.onboardingPending + model.materialsPending + (model.writeConsistencyIssues?.length ?? 0);
  return pending > 0 ? `${pending} 个维护信号` : "维护正常";
}

function metric(parent: HTMLElement, value: string, label: string): void {
  const item = parent.createDiv({ cls: "ts-system-health-metric" });
  item.createDiv({ cls: "ts-system-health-value", text: value });
  item.createDiv({ cls: "ts-system-health-label", text: label });
}

function contextChip(parent: HTMLElement, label: string, value: string): void {
  const chip = parent.createDiv({ cls: "ts-system-health-context-chip" });
  chip.createSpan({ cls: "ts-system-health-context-label", text: label });
  chip.createSpan({ cls: "ts-system-health-context-value", text: value });
}
