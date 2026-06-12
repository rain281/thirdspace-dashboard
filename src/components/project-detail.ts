import type { ManagedProject, ProjectDetailAction, ProjectHealthStatus } from "../data/project-management";

export interface ProjectDetailActions {
  backToPortfolio(): void;
  openFile(path: string): void;
  openWorkspace?(path: string): void;
  projectDetailAction?(projectId: string, action: ProjectDetailAction): void;
}

export function renderProjectDetailPage(
  parent: HTMLElement,
  project: ManagedProject | null,
  actions: ProjectDetailActions,
): void {
  const shell = parent.createDiv({ cls: "ts-project-detail-page" });
  const head = shell.createDiv({ cls: "ts-detail-route-head" });
  const back = head.createEl("button", { cls: "ts-detail-back-btn", text: "返回项目组合" });
  back.addEventListener("click", () => actions.backToPortfolio());
  head.createDiv({ cls: "ts-card-label", text: "PROJECT DETAIL" });

  if (!project) {
    shell.createDiv({ cls: "ts-card ts-project-detail-card ts-project-detail-card--empty" })
      .createDiv({ cls: "ts-empty", text: "No project selected" });
    return;
  }

  const card = shell.createDiv({ cls: "ts-card ts-project-detail-card" });
  const hero = card.createDiv({ cls: `ts-detail-hero ts-health--${healthClass(project.health.status)}` });
  const identity = hero.createDiv({ cls: "ts-detail-identity" });
  identity.createDiv({ cls: "ts-detail-title", text: project.name });
  const reasons = project.health.reasons.slice(0, 3);
  identity.createDiv({
    cls: "ts-detail-health-reasons",
    text: reasons.length > 0 ? reasons.join(" · ") : "No active health reasons",
  });
  const chips = hero.createDiv({ cls: "ts-detail-chips" });
  detailChip(chips, "Priority", project.priority, "priority");
  detailChip(chips, "Stage", project.stage, "stage");
  detailChip(chips, "Lifecycle", project.lifecycle, "lifecycle");
  detailChip(chips, "Health", project.health.status, "health");
  if (project.focusRole) detailChip(chips, "Focus", project.focusRole, "focus");
  detailChip(chips, "Updated", project.updated || "-", "updated");

  const grid = card.createDiv({ cls: "ts-detail-grid ts-detail-page-grid" });
  const main = grid.createDiv({ cls: "ts-detail-panel ts-detail-main" });
  main.createDiv({ cls: "ts-detail-panel-label", text: "推进判断" });
  detailSection(main, "Goal", project.goal, "goal", 2);
  detailSection(main, "Success", project.successCriteria, "success", 3);
  detailSection(main, "Milestone", project.milestone, "milestone", 2);
  detailSection(main, "Next Step", project.nextStep, "next", 3);

  const riskPanel = grid.createDiv({ cls: "ts-detail-panel ts-detail-risk-panel" });
  riskPanel.createDiv({ cls: "ts-detail-panel-label", text: "风险判断" });
  detailSection(riskPanel, "Risks", project.risks, "risks", 3);
  detailSection(riskPanel, "Decisions", project.pendingDecisions, "decisions", 3);
  detailSection(riskPanel, "Gates", project.deliveryGates, "gates", 3);

  const contextPanel = grid.createDiv({ cls: "ts-detail-panel ts-detail-context-panel" });
  contextPanel.createDiv({ cls: "ts-detail-panel-label", text: "接续判断" });
  detailSection(contextPanel, "Recent Status", project.recentStatus, "recent", 2);
  renderContextReadiness(contextPanel, project);
  renderQuickLinks(contextPanel, project, actions);

  renderProjectDetailActions(grid, project, actions);
}

function detailSection(parent: HTMLElement, label: string, markdown: string, key: string, limit: number): void {
  const section = parent.createDiv({ cls: `ts-detail-section ts-detail-section--${key}` });
  section.createDiv({ cls: "ts-detail-section-label", text: label });
  const items = summarize(markdown, limit);
  const list = section.createDiv({ cls: "ts-detail-summary-list" });
  for (const item of items) {
    list.createDiv({
      cls: `ts-detail-section-text ts-detail-summary-item ts-detail-summary-item--${item.state}`,
      text: item.text,
    });
  }
}

function renderContextReadiness(parent: HTMLElement, project: ManagedProject): void {
  const section = parent.createDiv({ cls: "ts-detail-section ts-detail-section--readiness" });
  section.createDiv({ cls: "ts-detail-section-label", text: "Context Readiness" });
  const row = section.createDiv({ cls: "ts-detail-readiness" });
  readinessChip(row, "首页", Boolean(project.projectHome));
  readinessChip(row, "状态", Boolean(project.statusNote));
  readinessChip(row, "上下文", Boolean(project.codexContext));
  readinessChip(row, "仓库", Boolean(project.repoPath));
}

function renderProjectDetailActions(parent: HTMLElement, project: ManagedProject, actions: ProjectDetailActions): void {
  if (!actions.projectDetailAction || project.lifecycle === "archived" || !project.statusNote) return;
  const section = parent.createDiv({ cls: "ts-detail-section ts-detail-section--actions ts-detail-action-panel" });
  section.createDiv({ cls: "ts-detail-section-label", text: "Actions" });
  const row = section.createDiv({ cls: "ts-detail-actions" });
  detailAction(row, "更新下一步", "next-step", project, actions);
  detailAction(row, "新增风险", "risk", project, actions);
  detailAction(row, "新增待决策", "decision", project, actions);
}

function detailAction(
  parent: HTMLElement,
  label: string,
  action: ProjectDetailAction,
  project: ManagedProject,
  actions: ProjectDetailActions,
): void {
  const btn = parent.createEl("button", { cls: `ts-detail-action-btn ts-detail-action--${action}`, text: label });
  btn.addEventListener("click", event => {
    event?.stopPropagation?.();
    actions.projectDetailAction?.(project.id, action);
  });
}

function readinessChip(parent: HTMLElement, label: string, ok: boolean): void {
  parent.createSpan({ cls: `ts-detail-readiness-chip ${ok ? "is-ready" : "is-missing"}`, text: label });
}

function detailChip(parent: HTMLElement, label: string, value: string, key: string): void {
  const chip = parent.createSpan({ cls: `ts-detail-chip ts-detail-chip--${key}` });
  chip.createSpan({ cls: "ts-detail-chip-label", text: label });
  chip.createSpan({ cls: "ts-detail-chip-value", text: value });
}

function renderQuickLinks(parent: HTMLElement, project: ManagedProject, actions: ProjectDetailActions): void {
  const section = parent.createDiv({ cls: "ts-detail-section ts-detail-section--links" });
  section.createDiv({ cls: "ts-detail-section-label", text: "Quick Links" });
  const links = section.createDiv({ cls: "ts-detail-links" });
  quickLink(links, "状态笔记", project.statusNote, actions);
  quickLink(links, "首页", project.projectHome, actions);
  quickLink(links, "上下文", project.codexContext, actions);
  quickLink(links, "工作区", project.workspace, actions, Boolean(actions.openWorkspace), path => actions.openWorkspace?.(path));
  quickLink(links, "仓库", project.repoPath, actions, false);
}

function quickLink(
  parent: HTMLElement,
  label: string,
  path: string,
  actions: ProjectDetailActions,
  openable = true,
  handler?: (path: string) => void,
): void {
  const row = parent.createDiv({
    cls: `ts-detail-link-row${openable && path ? " is-openable" : " is-muted"}`,
    attr: { title: linkTitle(label, path, openable) },
  });
  row.createSpan({ cls: "ts-detail-link-label", text: label });
  row.createSpan({ cls: "ts-detail-link-path", text: path || "-" });
  if (openable && path) row.addEventListener("click", () => handler ? handler(path) : actions.openFile(path));
}

function linkTitle(label: string, path: string, openable: boolean): string {
  if (!path) return `${label}缺失`;
  if (!openable) return `${label}只读路径：${path}`;
  return `${label}：${path}`;
}

interface SummaryItem {
  text: string;
  state: "plain" | "pending" | "done";
}

function summarize(markdown: string, limit: number): SummaryItem[] {
  const items = markdown
    .split("\n")
    .map(toSummaryItem)
    .filter((item): item is SummaryItem => Boolean(item?.text))
    .slice(0, limit);
  return items.length > 0 ? items : [{ text: "-", state: "plain" }];
}

function toSummaryItem(line: string): SummaryItem | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const checkbox = trimmed.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
  if (checkbox) {
    return {
      text: checkbox[2].trim(),
      state: checkbox[1].toLowerCase() === "x" ? "done" : "pending",
    };
  }
  return {
    text: trimmed.replace(/^\s*[-*]\s+/, "").trim(),
    state: "plain",
  };
}

function healthClass(status: ProjectHealthStatus): string {
  if (status === "风险") return "risk";
  if (status === "注意") return "attention";
  return "healthy";
}
