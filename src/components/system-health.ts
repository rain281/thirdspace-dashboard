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
  const card = parent.createDiv({ cls: "ts-card ts-compact-card ts-system-health-card" });
  const head = card.createDiv({ cls: "ts-card-head" });
  head.createSpan({ cls: "ts-card-label", text: "数据健康" });
  head.createSpan({ cls: "ts-card-meta", text: systemStatus(model) });

  const grid = card.createDiv({ cls: "ts-system-health-grid" });
  metric(grid, String(model.discoveryPending), "候选");
  metric(grid, String(model.onboardingPending), "接入");
  metric(grid, String(model.materialsPending), "资料");
  metric(grid, String(model.recentCount), "最近");
  metric(grid, String(model.workspaceCount), "工作区");
  metric(grid, String(model.gitRepoCount), "Git仓库");
  metric(grid, String(model.writeConsistencyIssues?.length ?? 0), "写入一致性");

  if (model.writeConsistencyIssues && model.writeConsistencyIssues.length > 0) {
    const list = card.createDiv({ cls: "ts-system-health-issues" });
    for (const issue of model.writeConsistencyIssues.slice(0, 5)) {
      const row = list.createDiv({ cls: "ts-system-health-issue" });
      row.createDiv({ cls: "ts-system-health-issue-title", text: issue.label });
      row.createDiv({ cls: "ts-system-health-issue-detail", text: issue.detail });
    }
  }
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
