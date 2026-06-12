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
  head.createSpan({ cls: "ts-card-label", text: "PORTFOLIO HEALTH" });
  head.createSpan({ cls: "ts-card-meta", text: `${model.summary.activeCount} active · ${model.summary.watchCount} watch` });
  const grid = card.createDiv({ cls: "ts-portfolio-metrics" });
  metric(grid, String(model.summary.totalManaged), "managed");
  metric(grid, `${model.summary.focusUsed}/${model.summary.focusLimit}`, "focus");
  metric(grid, String(model.summary.riskCount), "risk");
  metric(grid, String(model.summary.attentionCount), "attention");
  metric(grid, String(model.summary.staleCount), "stale");
  metric(grid, String(model.summary.noNextStepCount), "no next");
  metric(grid, String(model.summary.deliveryGateGapCount), "gate gaps");
}

function renderWeeklyFocus(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-weekly-focus-card" });
  const head = card.createDiv({ cls: "ts-card-head" });
  head.createSpan({ cls: "ts-card-label", text: "WEEKLY FOCUS" });
  head.createSpan({ cls: "ts-card-meta", text: model.focusWeek.week });

  const focusProjects = model.projects.filter(project => project.focusRole);
  if (focusProjects.length === 0) {
    card.createDiv({ cls: "ts-empty", text: emptyPortfolioText(model) });
    return;
  }

  const list = card.createDiv({ cls: "ts-focus-list" });
  for (const project of focusProjects) renderProjectCard(list, project, actions, true);
}

function renderFocusSuggestions(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-focus-suggestions-card" });
  const head = card.createDiv({ cls: "ts-card-head" });
  head.createSpan({ cls: "ts-card-label", text: "FOCUS SUGGESTIONS" });
  if (actions.confirmWeeklyFocus) {
    const btn = head.createEl("button", { cls: "ts-focus-confirm-btn", text: "确认下周 Focus" });
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
    card.createDiv({ cls: "ts-empty", text: model.projects.length === 0 ? "No managed Portfolio projects" : "No Focus suggestions" });
    return;
  }

  const list = card.createDiv({ cls: "ts-suggestion-list" });
  for (const project of suggestions) renderProjectCard(list, project, actions, false);
}

function renderRiskDecisionQueue(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-risk-queue-card" });
  card.createDiv({ cls: "ts-card-label", text: "RISK / DECISIONS" });
  const items = model.projects
    .filter(project => project.health.status === "风险" || compact(project.pendingDecisions))
    .slice(0, 6);

  if (items.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "No active risk or decision queue" });
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
  card.createDiv({ cls: "ts-card-label", text: "PRIORITY PROJECTS" });
  const items = model.projects.filter(project => project.priority === "P0" || project.priority === "P1").slice(0, 6);
  if (items.length === 0) {
    card.createDiv({ cls: "ts-empty", text: model.projects.length === 0 ? "No managed Portfolio projects" : "No P0 / P1 projects" });
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

function renderProjectQueue(parent: HTMLElement, label: string, markdown: string): void {
  const text = compact(markdown);
  if (!text) return;
  parent.createDiv({ cls: `ts-project-queue ts-project-queue--${label}`, text: `${label}: ${text}` });
}

function metric(parent: HTMLElement, value: string, label: string): void {
  const item = parent.createDiv({ cls: "ts-portfolio-metric" });
  item.createDiv({ cls: "ts-portfolio-metric-value", text: value });
  item.createDiv({ cls: "ts-portfolio-metric-label", text: label });
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

function compact(markdown: string): string {
  return markdown
    .split("\n")
    .map(line => line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, "").replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean)[0] ?? "";
}

function healthClass(status: ProjectHealthStatus): string {
  if (status === "风险") return "risk";
  if (status === "注意") return "attention";
  return "healthy";
}

function emptyPortfolioText(model: PortfolioModel): string {
  if (model.projects.length === 0) return "No managed Portfolio projects";
  if (model.focusWeek.confirmationStatus !== "confirmed") return "Weekly Focus pending confirmation";
  return "No weekly Focus set";
}
