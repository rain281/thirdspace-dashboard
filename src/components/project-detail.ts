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
  hero.createDiv({ cls: "ts-detail-title", text: project.name });
  hero.createDiv({
    cls: "ts-detail-health",
    text: [project.priority, project.stage, project.lifecycle, project.health.status, ...project.health.reasons.slice(0, 3)]
      .filter(Boolean)
      .join(" · "),
  });

  const grid = card.createDiv({ cls: "ts-detail-grid ts-detail-page-grid" });
  detailSection(grid, "Goal", project.goal);
  detailSection(grid, "Success", project.successCriteria);
  detailSection(grid, "Milestone", project.milestone);
  detailSection(grid, "Gates", project.deliveryGates);
  detailSection(grid, "Next Step", project.nextStep);
  detailSection(grid, "Risks", project.risks);
  detailSection(grid, "Decisions", project.pendingDecisions);
  detailSection(grid, "Recent Status", project.recentStatus);

  renderContextReadiness(grid, project);
  renderProjectDetailActions(grid, project, actions);
  renderQuickLinks(grid, project, actions);
}

function detailSection(parent: HTMLElement, label: string, markdown: string): void {
  const section = parent.createDiv({ cls: "ts-detail-section" });
  section.createDiv({ cls: "ts-detail-section-label", text: label });
  section.createDiv({ cls: "ts-detail-section-text", text: compact(markdown) || "-" });
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
  const section = parent.createDiv({ cls: "ts-detail-section ts-detail-section--actions" });
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
  const row = parent.createDiv({ cls: `ts-detail-link-row${openable && path ? " is-openable" : ""}` });
  row.createSpan({ cls: "ts-detail-link-label", text: label });
  row.createSpan({ cls: "ts-detail-link-path", text: path || "-" });
  if (openable && path) row.addEventListener("click", () => handler ? handler(path) : actions.openFile(path));
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
