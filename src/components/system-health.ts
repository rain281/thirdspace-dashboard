export type SystemHealthIssueActionKind = "confirm-weekly-focus" | "write-weekly-review" | "open-projects";

export interface SystemHealthIssueAction {
  kind: SystemHealthIssueActionKind;
  label: string;
}

export interface SystemHealthIssue {
  label: string;
  detail: string;
  action?: SystemHealthIssueAction;
}

export interface SystemHealthModel {
  discoveryPending: number;
  onboardingPending: number;
  materialsPending: number;
  recentCount: number;
  workspaceCount: number;
  gitRepoCount: number;
  writeConsistencyIssues?: SystemHealthIssue[];
}

export interface SystemHealthActions {
  onIssueAction?(issue: SystemHealthIssue): void;
}

export function renderSystemHealth(parent: HTMLElement, model: SystemHealthModel, actions: SystemHealthActions = {}): void {
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
  if (issues.length > 0) {
    renderIssueSwitcher(issueHead, issuePanel, issues, actions);
  } else {
    issueHead.createDiv({ cls: "ts-system-health-section-meta", text: "暂无" });
    const list = issuePanel.createDiv({ cls: "ts-system-health-issues" });
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

function renderIssueSwitcher(
  head: HTMLElement,
  panel: HTMLElement,
  issues: SystemHealthIssue[],
  actions: SystemHealthActions,
): void {
  let selected = 0;
  const controls = head.createDiv({ cls: "ts-system-health-switcher" });
  const prev = controls.createEl("button", {
    cls: "ts-system-health-switch ts-system-health-prev",
    text: "‹",
    attr: {
      type: "button",
      "aria-label": "上一条维护信号",
      title: "上一条维护信号",
    },
  });
  const meta = controls.createSpan({ cls: "ts-system-health-section-meta" });
  const next = controls.createEl("button", {
    cls: "ts-system-health-switch ts-system-health-next",
    text: "›",
    attr: {
      type: "button",
      "aria-label": "下一条维护信号",
      title: "下一条维护信号",
    },
  });
  const list = panel.createDiv({ cls: "ts-system-health-issues" });

  const renderSelected = () => {
    const issue = issues[selected];
    meta.setText(`${selected + 1}/${issues.length}`);
    list.empty();
    const row = list.createDiv({ cls: "ts-system-health-issue" });
    row.createDiv({ cls: "ts-system-health-issue-title", text: issue.label });
    row.createDiv({ cls: "ts-system-health-issue-detail", text: issue.detail });
    if (issue.action && actions.onIssueAction) {
      const btn = row.createEl("button", {
        cls: "ts-system-health-issue-action",
        text: issue.action.label,
        attr: {
          type: "button",
          "aria-label": issue.action.label,
          title: issue.action.label,
        },
      });
      btn.addEventListener("click", event => {
        event.stopPropagation();
        actions.onIssueAction?.(issue);
      });
    }
  };

  prev.disabled = issues.length <= 1;
  next.disabled = issues.length <= 1;
  prev.addEventListener("click", event => {
    event.stopPropagation();
    selected = (selected - 1 + issues.length) % issues.length;
    renderSelected();
  });
  next.addEventListener("click", event => {
    event.stopPropagation();
    selected = (selected + 1) % issues.length;
    renderSelected();
  });
  renderSelected();
}

function contextChip(parent: HTMLElement, label: string, value: string): void {
  const chip = parent.createDiv({ cls: "ts-system-health-context-chip" });
  chip.createSpan({ cls: "ts-system-health-context-label", text: label });
  chip.createSpan({ cls: "ts-system-health-context-value", text: value });
}
