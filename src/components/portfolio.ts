import type { ManagedProject, PortfolioModel, ProjectHealthStatus } from "../data/project-management";

export interface PortfolioActions {
  openFile(path: string): void;
  openWorkspace?(path: string): void;
  openProjectDetail?(projectId: string): void;
  selectProject?(projectId: string): void;
  confirmWeeklyFocus?(): void;
  selectedProjectId?: string | null;
}

export function renderPortfolio(
  parent: HTMLElement,
  model: PortfolioModel,
  actions: PortfolioActions,
): void {
  const shell = parent.createDiv({ cls: "ts-portfolio" });
  renderPortfolioHealth(shell, model);
  renderWeeklyFocus(shell, model, actions);
  renderFocusSuggestions(shell, model, actions);
  renderRiskDecisionQueue(shell, model, actions);
  renderPriorityProjects(shell, model, actions);
}

function renderPortfolioHealth(parent: HTMLElement, model: PortfolioModel): void {
  const card = parent.createDiv({ cls: "ts-card ts-portfolio-health-card" });
  const head = card.createDiv({ cls: "ts-card-head" });
  head.createSpan({ cls: "ts-card-label", text: "项目组合健康" });
  head.createSpan({ cls: "ts-card-meta", text: `${model.summary.activeCount} 活跃 · ${model.summary.watchCount} 观察` });
  const grid = card.createDiv({ cls: "ts-portfolio-metrics" });
  metric(grid, String(model.summary.totalManaged), "托管");
  metric(grid, `${model.summary.focusUsed}/${model.summary.focusLimit}`, "焦点");
  metric(grid, String(model.summary.riskCount), "风险");
  metric(grid, String(model.summary.attentionCount), "注意");
  metric(grid, String(model.summary.staleCount), "过期");
  metric(grid, String(model.summary.noNextStepCount), "缺下一步");
  metric(grid, String(model.summary.deliveryGateGapCount), "门禁缺口");
}

function renderWeeklyFocus(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-weekly-focus-card" });
  const head = card.createDiv({ cls: "ts-card-head" });
  head.createSpan({ cls: "ts-card-label", text: "本周焦点" });
  head.createSpan({ cls: "ts-card-meta", text: model.focusWeek.week });

  const focusProjects = model.projects.filter(project => project.focusRole);
  if (focusProjects.length === 0) {
    card.createDiv({ cls: "ts-empty", text: emptyPortfolioText(model) });
    return;
  }

  const list = card.createDiv({ cls: "ts-focus-card-grid" });
  for (const project of focusProjects.slice(0, 3)) renderFocusCardlet(list, project, actions);
}

function renderFocusSuggestions(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-focus-suggestions-card" });
  const head = card.createDiv({ cls: "ts-card-head" });
  head.createSpan({ cls: "ts-card-label", text: "焦点建议" });
  if (actions.confirmWeeklyFocus) {
    const btn = head.createEl("button", { cls: "ts-focus-confirm-btn", text: "确认下周焦点" });
    btn.addEventListener("click", event => {
      event.stopPropagation();
      actions.confirmWeeklyFocus?.();
    });
  }
  const suggestions = model.projects
    .filter(project => !project.focusRole && project.lifecycle !== "paused")
    .filter(project => project.priority === "P0" || project.priority === "P1" || project.health.status !== "健康")
    .slice(0, 4);

  if (suggestions.length === 0) {
    card.createDiv({ cls: "ts-empty", text: model.projects.length === 0 ? "暂无托管项目" : "暂无焦点建议" });
    return;
  }

  const list = card.createDiv({ cls: "ts-suggestion-list" });
  for (const project of suggestions) renderProjectCard(list, project, actions, false);
}

function renderRiskDecisionQueue(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-risk-queue-card" });
  card.createDiv({ cls: "ts-card-label", text: "风险 / 决策" });
  const items = model.projects
    .filter(project => project.health.status === "风险" || compact(project.pendingDecisions))
    .slice(0, 6);

  if (items.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "暂无活跃风险或待决策" });
    return;
  }

  const list = card.createDiv({ cls: "ts-risk-list" });
  for (const project of items) {
    const row = list.createDiv({ cls: `ts-risk-row ts-health--${healthClass(project.health.status)}` });
    bindOpen(row, project, actions);
    row.createDiv({ cls: "ts-risk-project", text: project.name });
    row.createDiv({ cls: "ts-risk-reasons", text: project.health.reasons.slice(0, 3).join(" · ") || "待决策" });
    row.createDiv({ cls: "ts-risk-next", text: compact(project.pendingDecisions || project.risks) || compact(project.deliveryGates) });
  }
}

function renderPriorityProjects(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-priority-card" });
  card.createDiv({ cls: "ts-card-label", text: "重点项目" });
  const items = model.projects.filter(project => project.priority === "P0" || project.priority === "P1").slice(0, 6);
  if (items.length === 0) {
    card.createDiv({ cls: "ts-empty", text: model.projects.length === 0 ? "暂无托管项目" : "暂无 P0 / P1 项目" });
    return;
  }
  const list = card.createDiv({ cls: "ts-priority-list" });
  for (const project of items) renderProjectCard(list, project, actions, false);
}

function renderProjectCard(parent: HTMLElement, project: ManagedProject, actions: PortfolioActions, focusCard: boolean): void {
  const row = parent.createDiv({
    cls: `ts-project-card ts-health--${healthClass(project.health.status)}${focusCard ? " ts-project-card--focus" : ""}${actions.selectedProjectId === project.id ? " is-selected" : ""}`,
  });
  bindOpen(row, project, actions);
  const top = row.createDiv({ cls: "ts-project-card-top" });
  top.createSpan({ cls: "ts-project-name", text: project.name });
  top.createSpan({
    cls: "ts-project-meta",
    text: [project.priority, project.stage, project.lifecycle, project.focusRole ?? ""].filter(Boolean).join(" · "),
  });
  row.createDiv({ cls: "ts-project-health", text: [project.health.status, ...project.health.reasons.slice(0, 3)].join(" · ") });
  row.createDiv({ cls: "ts-project-milestone", text: project.milestone || "缺当前里程碑" });
  row.createDiv({ cls: "ts-project-next", text: compact(project.nextStep) || "缺下一步" });
  renderProjectQueue(row, "risk", project.risks);
  renderProjectQueue(row, "decision", project.pendingDecisions);
  renderProjectQueue(row, "gate", project.deliveryGates);
}

function renderFocusCardlet(parent: HTMLElement, project: ManagedProject, actions: PortfolioActions): void {
  const row = parent.createDiv({
    cls: `ts-focus-cardlet ts-health--${healthClass(project.health.status)}${actions.selectedProjectId === project.id ? " is-selected" : ""}`,
  });
  bindOpen(row, project, actions);

  const top = row.createDiv({ cls: "ts-focus-cardlet-top" });
  top.createSpan({ cls: "ts-focus-role", text: focusRoleLabel(project.focusRole) });
  top.createSpan({ cls: "ts-focus-health", text: project.health.status });

  row.createDiv({ cls: "ts-focus-name", text: project.name });
  row.createDiv({ cls: "ts-focus-meta", text: [project.priority, project.stage, project.lifecycle].filter(Boolean).join(" · ") });
  row.createDiv({ cls: "ts-focus-milestone", text: project.milestone || "缺当前里程碑" });
  row.createDiv({ cls: "ts-focus-next", text: compact(project.nextStep) || "缺下一步" });

  const badges = row.createDiv({ cls: "ts-focus-badges" });
  focusBadge(badges, "风险", countMarkdownItems(project.risks));
  focusBadge(badges, "决策", countMarkdownItems(project.pendingDecisions));
  focusBadge(badges, "门禁", countMarkdownItems(project.deliveryGates));
}

function renderProjectQueue(parent: HTMLElement, label: string, markdown: string): void {
  const text = compact(markdown);
  if (!text) return;
  parent.createDiv({ cls: `ts-project-queue ts-project-queue--${label}`, text: `${projectQueueLabel(label)}: ${text}` });
}

function projectQueueLabel(label: string): string {
  if (label === "risk") return "风险";
  if (label === "decision") return "决策";
  if (label === "gate") return "门禁";
  return label;
}

function metric(parent: HTMLElement, value: string, label: string): void {
  const item = parent.createDiv({ cls: "ts-portfolio-metric" });
  item.createDiv({ cls: "ts-portfolio-metric-value", text: value });
  item.createDiv({ cls: "ts-portfolio-metric-label", text: label });
}

function focusBadge(parent: HTMLElement, label: string, count: number): void {
  parent.createSpan({
    cls: `ts-focus-badge${count > 0 ? " has-items" : ""}`,
    text: `${label} ${count}`,
  });
}

function bindOpen(element: HTMLElement, project: ManagedProject, actions: PortfolioActions): void {
  element.addEventListener("click", () => {
    if (actions.openProjectDetail) {
      actions.openProjectDetail(project.id);
      return;
    }
    if (actions.selectProject) {
      actions.selectProject(project.id);
      return;
    }
    const path = project.statusNote || project.projectHome;
    if (path) actions.openFile(path);
  });
}

function focusRoleLabel(role: string | null): string {
  if (role === "main") return "主项目";
  if (role === "support") return "副项目";
  if (role === "maintenance") return "维护";
  return "焦点";
}

function compact(markdown: string): string {
  return markdown
    .split("\n")
    .map(line => line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, "").replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean)[0] ?? "";
}

function countMarkdownItems(markdown: string): number {
  const lines = markdown
    .split("\n")
    .map(line => line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, "").replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
  return lines.length;
}

function healthClass(status: ProjectHealthStatus): string {
  if (status === "风险") return "risk";
  if (status === "注意") return "attention";
  return "healthy";
}

function emptyPortfolioText(model: PortfolioModel): string {
  if (model.projects.length === 0) return "暂无托管项目";
  if (model.focusWeek.confirmationStatus !== "confirmed") return "本周焦点待确认";
  return "暂无本周焦点";
}
