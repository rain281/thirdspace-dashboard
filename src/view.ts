import { ItemView, Modal, Notice, WorkspaceLeaf, TFile, TAbstractFile, setIcon } from "obsidian";
import type ThirdSpaceDashboard from "./main";
import {
  loadWorkspaceIndex, getWorkspaceStats, getDailyActivity,
  loadProductStatus, parseProducts, getRecentFiles,
  getProjectActivity, getGitActivity,
  localDateStr, localDateCompact, localTimestamp,
  loadTodos, loadTodayWorklog, loadWeeklyWorklogs, getVaultStats, getTodayWorklogPath,
  ensureTodayWorklog, addTodoToWorklog, toggleTodoInWorklog, renameTodoInWorklog,
  loadProjectBacklog, promoteProjectBacklogItemToToday,
  type WorkspaceStats, type TodoItem, type VaultStats, type TodayWorklog,
  type DailyActivity, type ProjectActivity, type GitActivitySummary,
  type ProjectBacklogItem, type RecentFile, type TimelineItem, type TimelineKind,
} from "./data/vault-reader";
import {
  PROJECT_DISCOVERY_INBOX_PATH,
  acceptProjectCandidate,
  ignoreProjectCandidate,
  loadProjectDiscoverySnapshot,
  type ProjectCandidate,
  type ProjectDiscoverySummary,
} from "./data/project-discovery";
import {
  loadProjectOnboarding,
  runProjectOnboarding,
  type ProjectOnboardingItem,
} from "./data/project-onboarding";
import {
  loadProjectMaterials,
  runProjectMaterialsImport,
  type ProjectMaterialsItem,
} from "./data/project-materials";
import { loadPortfolioModel } from "./data/project-management-reader";
import {
  deriveTodayExecution,
  deriveTodayFocusCoverage,
  createFocusConfirmationPreviews,
  createProjectDetailActionPreview,
  deriveWriteConsistencyIssues,
  focusWeeklyPlanPath,
  FOCUS_WEEK_PATH,
  nextIsoWeek,
  selectTodayNextAction,
  type PortfolioModel,
  type ProjectDetailAction,
  type TodayExecutionModel,
  type TodayFocusCoverage,
} from "./data/project-management";
import { buildSnakeCells, type SnakeCell } from "./data/worklog-parser";
import { DASHBOARD_PAGES, type DashboardPage } from "./components/page-switch";
import { applyControlledWritePreview, type ControlledWritePreview } from "./data/controlled-write";
import {
  createDiscoveryCandidateOperationPreview,
  createMaterialsOperationPreview,
  createNewNoteOperationPreview,
  createOnboardingOperationPreview,
  createPromoteBacklogOperationPreview,
  createTodayWorklogOperationPreview,
  createTodoAddOperationPreview,
  createTodoRenameOperationPreview,
  createTodoToggleOperationPreview,
} from "./data/dashboard-operation-preview";
import { createWeeklyReviewWritePreview, deriveWeeklyReview, weeklyPlanPath } from "./data/weekly-review";
import { renderPortfolio } from "./components/portfolio";
import { renderProjectDetailPage } from "./components/project-detail";
import { renderSystemHealth } from "./components/system-health";
import { renderTodayExecution } from "./components/today-execution";
import { renderTodayFocusStrip } from "./components/today-focus-strip";
import { renderWeeklyReview } from "./components/weekly-review";
import { renderWritePreviewModalContent } from "./components/write-preview-modal";
import { renderSnakeHeatmap, type SnakeRouteCache } from "./components/snake-heatmap";
import { buildGitActivityCardModel } from "./components/git-activity-summary";
import { canCommitRenderPass, RenderPassGuard } from "./data/render-pass";

export const VIEW_TYPE = "thirdspace-dashboard";
type TimelineFilter = "all" | TimelineKind;

interface TodayMetrics {
  total: number;
  pending: number;
  done: number;
  outputs: number;
  git: number;
  agent: number;
  projects: number;
  blocked: number;
  focus?: TodoItem;
}

interface NextAction {
  tone: "missing" | "warn" | "todo" | "pool" | "summary" | "idle";
  badge: string;
  title: string;
  reason: string;
  button: string;
  target: "today" | "project";
  projectItem?: ProjectBacklogItem;
  risks: string[];
}

interface TimelineSummary {
  summary: string;
  chips: string[];
}

// ── Todo Input Modal ──────────────────────────────────────────
class TodoModal extends Modal {
  private onSubmit: (text: string) => void;
  constructor(app: any, onSubmit: (text: string) => void) {
    super(app); this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ts-modal");
    contentEl.createEl("h3", { text: "新增 Todo", cls: "ts-modal-title" });

    const input = contentEl.createEl("input", { type: "text", cls: "ts-modal-input" });
    input.placeholder = "输入 todo 内容";
    input.focus();

    const submit = () => {
      const val = input.value.trim();
      if (val) { this.onSubmit(val); this.close(); }
    };

    const row = contentEl.createDiv({ cls: "ts-modal-row" });
    const btn = row.createEl("button", { text: "添加", cls: "ts-modal-btn ts-modal-btn--primary" });
    btn.addEventListener("click", submit);
    const cancel = row.createEl("button", { text: "取消", cls: "ts-modal-btn" });
    cancel.addEventListener("click", () => this.close());
  }
  onClose() { this.contentEl.empty(); }
}

class TextInputModal extends Modal {
  private title: string;
  private placeholder: string;
  private onSubmit: (text: string) => void;

  constructor(app: any, title: string, placeholder: string, onSubmit: (text: string) => void) {
    super(app);
    this.title = title;
    this.placeholder = placeholder;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ts-modal");
    contentEl.createEl("h3", { text: this.title, cls: "ts-modal-title" });
    const input = contentEl.createEl("input", { type: "text", cls: "ts-modal-input" });
    input.placeholder = this.placeholder;
    input.focus();
    const submit = () => {
      const val = input.value.trim();
      if (val) {
        this.onSubmit(val);
        this.close();
      }
    };
    const row = contentEl.createDiv({ cls: "ts-modal-row" });
    const confirm = row.createEl("button", { text: "生成预览", cls: "ts-modal-btn ts-modal-btn--primary" });
    confirm.addEventListener("click", submit);
    const cancel = row.createEl("button", { text: "取消", cls: "ts-modal-btn" });
    cancel.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

function projectDetailActionTitle(projectName: string, action: ProjectDetailAction): string {
  if (action === "next-step") return `更新 ${projectName} 下一步`;
  if (action === "risk") return `新增 ${projectName} 风险`;
  return `新增 ${projectName} 待决策`;
}

function projectDetailActionPlaceholder(action: ProjectDetailAction): string {
  if (action === "next-step") return "输入下一步，例如：完成部署验证";
  if (action === "risk") return "输入风险或阻塞，例如：权限方案未确认";
  return "输入待决策问题，例如：是否先做只读版";
}

class WritePreviewModal extends Modal {
  private preview: ControlledWritePreview;
  private onConfirmWrite: () => Promise<void>;

  constructor(app: any, preview: ControlledWritePreview, onConfirmWrite: () => Promise<void>) {
    super(app);
    this.preview = preview;
    this.onConfirmWrite = onConfirmWrite;
  }

  onOpen() {
    renderWritePreviewModalContent(this.contentEl, this.preview, {
      onCancel: () => this.close(),
      onConfirm: () => {
        void this.confirm();
      },
    });
  }

  onClose() {
    this.contentEl.empty();
  }

  private async confirm() {
    try {
      await this.onConfirmWrite();
      this.close();
    } catch (error) {
      new Notice(`写入失败：${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

// ── Dashboard View ────────────────────────────────────────────
export class DashboardView extends ItemView {
  plugin: ThirdSpaceDashboard;
  private timer: number | null = null;
  private liveRenderTimer: number | null = null;
  private activePage: DashboardPage = "today";
  private timelineFilter: TimelineFilter = "all";
  private selectedProjectId: string | null = null;
  private projectsViewMode: "portfolio" | "detail" = "portfolio";
  private snakeRouteCache: SnakeRouteCache | null = null;
  private snakeReplayTimer: number | null = null;
  private readonly renderPassGuard = new RenderPassGuard();
  private readonly singleScreenLimit = {
    todos: 5,
    highlights: 3,
    entries: 2,
    outputs: 6,
    events: 4,
    products: 5,
    materials: 5,
  };

  constructor(leaf: WorkspaceLeaf, plugin: ThirdSpaceDashboard) {
    super(leaf); this.plugin = plugin;
  }

  getViewType()    { return VIEW_TYPE; }
  getDisplayText() { return "ThirdSpace"; }
  getIcon()        { return "layout-dashboard"; }

  async onOpen()  {
    this.containerEl.addClass("ts-root");
    await this.render();
    this.timer = window.setInterval(() => this.render(), 60_000);
    this.registerLiveRefresh();
  }
  onClose()       {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.liveRenderTimer) { clearTimeout(this.liveRenderTimer); this.liveRenderTimer = null; }
    if (this.snakeReplayTimer) { clearTimeout(this.snakeReplayTimer); this.snakeReplayTimer = null; }
    return Promise.resolve();
  }

  async render() {
    const renderPass = this.renderPassGuard.begin();
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ts-dash");

    const [wsIndex, productMd, activity, projectActivity, gitActivity, todos, projectBacklog, todayWorklog, weeklyWorklogs, discovery, onboarding, materials] = await Promise.all([
      loadWorkspaceIndex(this.app),
      loadProductStatus(this.app),
      getDailyActivity(this.app, 365),
      getProjectActivity(this.app, { period: "week", limit: 3 }),
      getGitActivity(this.app, 90),
      loadTodos(this.app),
      loadProjectBacklog(this.app),
      loadTodayWorklog(this.app),
      loadWeeklyWorklogs(this.app),
      loadProjectDiscoverySnapshot(this.app),
      loadProjectOnboarding(this.app),
      loadProjectMaterials(this.app),
    ]);

    const wsDirs    = wsIndex?.map(e => e.dir) ?? [];
    const [wsStats, vaultStats, recent] = await Promise.all([
      getWorkspaceStats(this.app, wsDirs),
      getVaultStats(this.app),
      getRecentFiles(this.app, 7),
    ]);
    const products  = productMd ? parseProducts(productMd) : [];
    const pending   = todos.filter(t => !t.done);
    const portfolio = await loadPortfolioModel(this.app);
    const weeklyPlanContent = this.activePage === "system"
      ? await this.app.vault.adapter.read(focusWeeklyPlanPath(portfolio.focusWeek.week)).catch(() => "")
      : "";

    if (!canCommitRenderPass(this.renderPassGuard, renderPass, this.containerEl)) return;
    contentEl.empty();
    contentEl.addClass("ts-dash");

    // ── macOS dashboard shell
    const hdr = contentEl.createDiv({ cls: "ts-hdr" });
    const hdrL = hdr.createDiv({ cls: "ts-hdr-left" });
    const titleBlock = hdrL.createDiv({ cls: "ts-title-block" });
    titleBlock.createDiv({ cls: "ts-app-title", text: "ThirdSpace" });
    titleBlock.createDiv({ cls: "ts-vault-title", text: (this.app.vault as any).getName?.() ?? "Vault" });
    const pill = hdrL.createDiv({ cls: `ts-pill ${wsIndex ? "ts-pill--ok" : "ts-pill--warn"}` });
    pill.setText(wsIndex ? `${wsStats.length} 个工作区` : "缺 .thirdspace");
    if (discovery.pending.length > 0 || discovery.error) {
      const discoveryPill = hdrL.createDiv({
        cls: `ts-pill ${discovery.error ? "ts-pill--warn" : "ts-pill--notice"}`,
        text: discovery.error ? "项目扫描异常" : `${discovery.pending.length} 个项目候选`,
      });
      discoveryPill.addEventListener("click", () => this.openFile(PROJECT_DISCOVERY_INBOX_PATH));
    }
    const refreshBtn = hdr.createDiv({ cls: "ts-hdr-right" }).createEl("button", {
      cls: "ts-icon-btn",
      attr: { "aria-label": "Refresh dashboard", title: "刷新 Dashboard" },
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => { this.snakeRouteCache = null; this.render(); });

    const board = contentEl.createDiv({ cls: `ts-board ts-board--${this.activePage}` });
    if (this.activePage === "today") {
      this.renderTodayPage(board, todos, projectBacklog, todayWorklog, portfolio);
    } else if (this.activePage === "projects") {
      this.renderProjectsPage(board, portfolio);
    } else if (this.activePage === "review") {
      this.renderReviewPage(board, portfolio, weeklyWorklogs);
    } else {
      this.renderSystemPage(board, activity, projectActivity, gitActivity, wsStats, recent, products, discovery, onboarding, materials, portfolio, weeklyPlanContent);
    }
    this.renderPageSwitch(contentEl);

  }

  private renderTodayPage(
    board: HTMLElement,
    todos: TodoItem[],
    projectBacklog: ProjectBacklogItem[],
    todayWorklog: TodayWorklog | null,
    portfolio: PortfolioModel,
  ) {
    const pending = todos.filter(t => !t.done);
    const today = todayWorklog ?? this.emptyTodayWorklog();
    const focusCoverage = deriveTodayFocusCoverage(portfolio, this.extractProjectNames(today));
    const todayExecution = deriveTodayExecution(today, portfolio, projectBacklog, focusCoverage);

    const overviewCol = board.createDiv({ cls: "ts-board-col ts-overview-col" });
    const overviewCard = overviewCol.createDiv({ cls: "ts-card ts-compact-card ts-overview-card ts-next-action-card" });
    this.renderNextAction(overviewCard, today, !todayWorklog, projectBacklog, todayExecution);

    const quickCol = board.createDiv({ cls: "ts-board-col ts-quick-col" });
    const actCard = quickCol.createDiv({ cls: "ts-card ts-compact-card ts-quick-card" });
    actCard.createDiv({ cls: "ts-card-label", text: "快捷操作" });
    this.renderActions(actCard);

    const todayCol = board.createDiv({ cls: "ts-board-col ts-today-col" });
    const logCard = todayCol.createDiv({ cls: "ts-card ts-compact-card ts-today-card" });
    const logHd   = logCard.createDiv({ cls: "ts-card-head" });
    logHd.createSpan({ cls: "ts-card-label", text: "今日" });
    logHd.createSpan({ cls: "ts-card-meta", text: new Date().toLocaleDateString("zh-CN",{month:"short",day:"numeric",weekday:"short"}) });
    this.renderTodayWorklog(logCard, today, !todayWorklog, focusCoverage, todayExecution);

    const todoCol = board.createDiv({ cls: "ts-board-col ts-todo-col" });
    const todoCard = todoCol.createDiv({ cls: "ts-card ts-compact-card ts-todo-card" });
    const tdHd = todoCard.createDiv({ cls: "ts-card-head" });
    tdHd.createSpan({ cls: "ts-card-label", text: "今日待办" });
    const todoActions = tdHd.createSpan({ cls: "ts-todo-head-actions" });
    const tdMeta = todoActions.createSpan({ cls: "ts-card-meta ts-todo-meta" });
    if (pending.length > 0) tdMeta.setText(`${pending.length} 未完成`);
    const copyAll = todoActions.createEl("button", {
      cls: "ts-todo-copy-btn",
      attr: { "aria-label": "复制未完成 Todo", title: "复制未完成 Todo" },
    });
    setIcon(copyAll, "copy");
    copyAll.addEventListener("click", ev => {
      ev.stopPropagation();
      void this.copyPendingTodos(todos);
    });
    this.renderTodos(todoCard, todos);

    const backlogCol = board.createDiv({ cls: "ts-board-col ts-backlog-col" });
    const backlogCard = backlogCol.createDiv({ cls: "ts-card ts-compact-card ts-backlog-card" });
    const bgHd = backlogCard.createDiv({ cls: "ts-card-head" });
    bgHd.createSpan({ cls: "ts-card-label", text: "项目池" });
    bgHd.createSpan({ cls: "ts-card-meta", text: `${projectBacklog.length} 项` });
    this.renderProjectBacklog(backlogCard, projectBacklog);
  }

  private renderProjectsPage(
    board: HTMLElement,
    portfolio: PortfolioModel,
  ) {
    if (this.projectsViewMode === "detail") {
      board.addClass("ts-board--projects-detail");
      const project = portfolio.projects.find(item => item.id === this.selectedProjectId) ?? null;
      renderProjectDetailPage(board, project, {
        backToPortfolio: () => {
          this.projectsViewMode = "portfolio";
          void this.render();
        },
        openFile: path => this.openFile(path),
        openWorkspace: path => this.openWorkspace(path),
        projectDetailAction: (projectId, action) => {
          void this.openProjectDetailActionModal(portfolio, projectId, action);
        },
      });
      return;
    }

    const portfolioCol = board.createDiv({ cls: "ts-board-col ts-portfolio-col" });
    renderPortfolio(
      portfolioCol,
      portfolio,
      {
        selectedProjectId: this.selectedProjectId,
        openProjectDetail: projectId => {
          this.selectedProjectId = projectId;
          this.projectsViewMode = "detail";
          void this.render();
        },
        openFile: path => this.openFile(path),
        openWorkspace: path => this.openWorkspace(path),
        confirmWeeklyFocus: async () => {
          const week = nextIsoWeek();
          const [existingFocusYaml, existingWeeklyPlan] = await Promise.all([
            this.app.vault.adapter.read(FOCUS_WEEK_PATH).catch(() => ""),
            this.app.vault.adapter.read(focusWeeklyPlanPath(week)).catch(() => ""),
          ]);
          const previews = createFocusConfirmationPreviews({
            week,
            projects: portfolio.projects,
            existingFocusYaml,
            existingWeeklyPlan,
          });
          this.confirmAndApplyWrites([previews.yaml, previews.weeklyPlan]);
        },
      },
    );
  }

  private renderReviewPage(
    board: HTMLElement,
    portfolio: PortfolioModel,
    weeklyWorklogs: Awaited<ReturnType<typeof loadWeeklyWorklogs>>,
  ) {
    const review = deriveWeeklyReview(portfolio, weeklyWorklogs);
    renderWeeklyReview(board, review, {
      onWriteWeeklyReview: async () => {
        const path = weeklyPlanPath(review.week);
        const existingContent = await this.app.vault.adapter.read(path).catch(() => "");
        this.confirmAndApplyWrite(createWeeklyReviewWritePreview(review, { existingContent }));
      },
    });
  }

  private renderSystemPage(
    board: HTMLElement,
    activity: DailyActivity[],
    projectActivity: ProjectActivity[],
    gitActivity: GitActivitySummary,
    wsStats: WorkspaceStats[],
    recent: RecentFile[],
    products: ReturnType<typeof parseProducts>,
    discovery: ProjectDiscoverySummary,
    onboarding: ProjectOnboardingItem[],
    materials: ProjectMaterialsItem[],
    portfolio: PortfolioModel,
    weeklyPlanContent: string,
  ) {
    const healthCol = board.createDiv({ cls: "ts-board-col ts-system-health-col" });
    renderSystemHealth(healthCol, {
      discoveryPending: discovery.pending.length,
      onboardingPending: onboarding.filter(item => item.needsOnboarding).length,
      materialsPending: materials.filter(item => item.needsImport).length,
      recentCount: recent.length,
      workspaceCount: wsStats.length,
      gitRepoCount: gitActivity.repos.length,
      writeConsistencyIssues: deriveWriteConsistencyIssues({ portfolio, weeklyPlanContent }),
    });

    const activityCol = board.createDiv({ cls: "ts-board-col ts-system-activity-col" });
    const heatSec  = activityCol.createDiv({ cls: "ts-card ts-compact-card ts-heatmap-card" });
    if (this.snakeReplayTimer) { clearTimeout(this.snakeReplayTimer); this.snakeReplayTimer = null; }
    this.renderActivityDashboard(heatSec, activity, projectActivity, gitActivity);

    const maintenanceGrid = board.createDiv({ cls: "ts-board-col ts-system-grid ts-maintenance-grid" });
    const wsCard = maintenanceGrid.createDiv({ cls: "ts-card ts-compact-card ts-workspaces-card" });
    wsCard.createDiv({ cls: "ts-card-label", text: "工作区" });
    this.renderWorkspaces(wsCard, wsStats);

    const recCard = maintenanceGrid.createDiv({ cls: "ts-card ts-compact-card ts-recent-card" });
    recCard.createDiv({ cls: "ts-card-label", text: "最近文件" });
    this.renderRecent(recCard, recent);

    const materialsCard = maintenanceGrid.createDiv({ cls: "ts-card ts-compact-card ts-materials-card" });
    materialsCard.createDiv({ cls: "ts-card-label", text: "项目资料" });
    this.renderProjectMaterialsCard(materialsCard, materials);

    const prodCard = maintenanceGrid.createDiv({ cls: "ts-card ts-compact-card ts-products-card" });
    prodCard.createDiv({ cls: "ts-card-label", text: "系统 / 收件箱" });
    this.renderProducts(prodCard, products, discovery, onboarding);
  }

  private renderPageSwitch(parent: HTMLElement) {
    const switcher = parent.createDiv({ cls: "ts-page-switch" });
    for (const page of DASHBOARD_PAGES) {
      const btn = switcher.createEl("button", {
        cls: `ts-page-btn ${this.activePage === page.id ? "is-active" : ""}`,
        attr: { "aria-label": page.label, title: page.label },
      });
      const icon = btn.createSpan({ cls: "ts-page-icon" });
      setIcon(icon, page.icon);
      btn.createSpan({ cls: "ts-page-label", text: page.label });
      btn.addEventListener("click", async () => {
        if (this.activePage === page.id) return;
        this.activePage = page.id;
        await this.render();
      });
    }
  }

  // ── Stats row
  private renderStatsRow(parent: HTMLElement, s: VaultStats, activeDays: number) {
    const row = parent.createDiv({ cls: "ts-stats-row" });
    const stats = [
      { value: s.total, label: "files", icon: "files" },
      { value: s.thisWeek, label: "this week", icon: "calendar-days" },
      { value: s.thisMonth, label: "this month", icon: "calendar-range" },
      { value: activeDays, label: "active days", icon: "activity" },
    ];
    stats.forEach((st, idx) => {
      const cell = row.createDiv({ cls: "ts-stat-cell", attr: { style: `--ts-i:${idx}` } });
      const icon = cell.createDiv({ cls: "ts-stat-icon" });
      setIcon(icon, st.icon);
      const copy = cell.createDiv({ cls: "ts-stat-copy" });
      copy.createDiv({ cls: "ts-stat-num", text: String(st.value) });
      copy.createDiv({ cls: "ts-stat-lbl", text: st.label });
    });
  }

  // ── Activity: quiet 90-day dashboard, all three signals visible
  private renderActivityDashboard(
    parent: HTMLElement,
    activity: DailyActivity[],
    projects: ProjectActivity[],
    git: GitActivitySummary,
  ) {
    const recent90 = this.fillRecentDays(activity, 90);
    const recent7 = recent90.slice(-7);
    const activeDays90 = recent90.filter(d => d.count > 0).length;
    const weekCount = recent7.reduce((sum, d) => sum + d.count, 0);
    const todayCount = recent90[recent90.length - 1]?.count ?? 0;
    const streak = this.calcStreak(activity);
    const topProject = projects.find(p => p.lifecycle !== "archived" && p.recentCount > 0) ?? projects.find(p => p.recentCount > 0);

    const head = parent.createDiv({ cls: "ts-card-head ts-activity-head" });
    const title = head.createDiv({ cls: "ts-activity-title" });
    title.createSpan({ cls: "ts-card-label", text: "活动概览" });
    title.createSpan({
      cls: "ts-card-meta",
      text: `近90天 · ${activeDays90} 活跃 · 本周 ${weekCount}${streak > 0 ? ` · 连续 ${streak} 天` : ""}`,
    });

    const headMeta = head.createDiv({ cls: "ts-activity-head-metrics" });
    this.renderActivityMetric(headMeta, "今日", todayCount, "文件");
    this.renderActivityMetric(headMeta, "本周最多", topProject?.name ?? "—", topProject ? `${topProject.recentCount} 文件` : "无项目");

    const body = parent.createDiv({ cls: "ts-activity-body" });
    const vaultPanel = body.createDiv({ cls: "ts-activity-panel ts-activity-panel--vault" });
    vaultPanel.createDiv({ cls: "ts-activity-panel-title", text: "全库 90 天" });
    this.renderNinetyDayCalendar(vaultPanel, recent90);

    const projectPanel = body.createDiv({ cls: "ts-activity-panel ts-activity-panel--projects" });
    projectPanel.createDiv({ cls: "ts-activity-panel-title", text: "项目活跃 · 本周 Top 3" });
    this.renderProjectActivity(projectPanel, projects);

    const gitPanel = body.createDiv({ cls: "ts-activity-panel ts-activity-panel--git" });
    gitPanel.createDiv({ cls: "ts-activity-panel-title", text: "Git 提交" });
    this.renderGitActivity(gitPanel, git);
  }

  private renderActivityMetric(parent: HTMLElement, label: string, value: string | number, sub: string) {
    const item = parent.createDiv({ cls: "ts-activity-metric" });
    item.createDiv({ cls: "ts-activity-metric-value", text: String(value) });
    const row = item.createDiv({ cls: "ts-activity-metric-row" });
    row.createSpan({ cls: "ts-activity-metric-label", text: label });
    row.createSpan({ cls: "ts-activity-metric-sub", text: sub });
  }

  private renderNinetyDayCalendar(parent: HTMLElement, days: DailyActivity[]) {
    const wrap = parent.createDiv({ cls: "ts-activity-calendar-wrap" });
    const months = wrap.createDiv({ cls: "ts-activity-months" });
    const monthLabels = this.calendarMonthLabels(days);
    for (const item of monthLabels) {
      months.createSpan({ cls: "ts-activity-month", text: item.label, attr: { style: `grid-column:${item.start} / ${item.end}` } });
    }

    const grid = wrap.createDiv({ cls: "ts-activity-calendar" });
    const max = Math.max(...days.map(d => d.count), 1);
    days.forEach((day, idx) => {
      const level = this.activityLevel(day.count, max);
      const cell = grid.createDiv({ cls: `ts-day-cell ts-day-cell--${level}`, attr: { style: `--ts-i:${idx}` } });
      cell.setAttr("title", `${day.date}: ${day.count}`);
      cell.setAttr("aria-label", `${day.date}: ${day.count}`);
    });

    const trend = parent.createDiv({ cls: "ts-activity-week-trend" });
    days.slice(-14).forEach((day, idx) => {
      const bar = trend.createDiv({ cls: "ts-trend-bar" });
      const pct = max > 0 ? Math.max(6, Math.round(day.count / max * 100)) : 6;
      bar.createDiv({ cls: "ts-trend-fill", attr: { style: `height:${pct}%;--ts-i:${idx}` } });
      bar.setAttr("title", `${day.date}: ${day.count}`);
    });
  }

  private renderProjectActivity(parent: HTMLElement, projects: ProjectActivity[]) {
    const list = parent.createDiv({ cls: "ts-project-activity-list" });
    const visible = projects;
    const max = Math.max(...visible.map(p => p.recentCount), 1);
    if (visible.length === 0) {
      list.createDiv({ cls: "ts-empty", text: "本周暂无项目更新" });
      return;
    }
    visible.forEach((project, idx) => {
      const row = list.createDiv({
        cls: `ts-project-activity-row${project.lifecycle === "archived" ? " is-archived" : ""}`,
        attr: { style: `--ts-i:${idx}` },
      });
      const copy = row.createDiv({ cls: "ts-project-activity-copy" });
      copy.createDiv({ cls: "ts-project-activity-name", text: project.name });
      copy.createDiv({ cls: "ts-project-activity-meta", text: `本周 ${project.recentCount} 文件 · ${project.lastModified ? this.relTime(project.lastModified) : "—"}` });
      const bar = row.createDiv({ cls: "ts-project-activity-bar" });
      bar.createDiv({ cls: "ts-project-activity-fill", attr: { style: `width:${Math.round(project.recentCount / max * 100)}%;--ts-i:${idx}` } });
    });
  }

  private renderGitActivity(parent: HTMLElement, git: GitActivitySummary) {
    const model = buildGitActivityCardModel(git);
    const summary = parent.createDiv({ cls: "ts-git-summary" });
    this.renderGitMetric(summary, "近90天", model.totalLabel, "提交");
    this.renderGitMetric(summary, "今日", model.todayLabel, "提交");
    this.renderGitMetric(summary, "最多", model.topRepoLabel, model.topRepoMeta);
    this.renderGitMetric(summary, "最近", model.latestRepoLabel, model.latestRepoMeta);

    const chart = parent.createDiv({ cls: "ts-git-trend" });
    const max = Math.max(...git.days.map(d => d.count), 1);
    git.days.forEach((day, idx) => {
      const bar = chart.createDiv({ cls: "ts-git-day" });
      const pct = day.count > 0 ? Math.max(8, Math.round(day.count / max * 100)) : 0;
      bar.createDiv({ cls: "ts-git-fill", attr: { style: `height:${pct}%;--ts-i:${idx}` } });
      bar.setAttr("title", `${day.date}: ${day.count} 次提交`);
    });

    const repos = parent.createDiv({ cls: "ts-git-repo-list" });
    if (model.repoRows.length === 0) {
      repos.createDiv({ cls: "ts-empty", text: "暂无 Git 活动" });
      return;
    }
    model.repoRows.forEach((repo, idx) => {
      const row = repos.createDiv({ cls: "ts-git-repo-row", attr: { style: `--ts-i:${idx}` } });
      row.createSpan({ cls: "ts-git-repo-name", text: repo.name });
      row.createSpan({ cls: "ts-git-repo-branch", text: repo.branch });
      row.createSpan({ cls: "ts-git-repo-count", text: repo.countLabel });
      row.createDiv({ cls: "ts-git-repo-bar" }).createDiv({
        cls: "ts-git-repo-fill",
        attr: { style: `width:${repo.widthPercent}%;--ts-i:${idx}` },
      });
    });
  }

  private renderGitMetric(parent: HTMLElement, label: string, value: string, sub: string) {
    const item = parent.createDiv({ cls: "ts-git-metric" });
    item.createDiv({ cls: "ts-git-metric-value", text: value });
    const row = item.createDiv({ cls: "ts-git-metric-row" });
    row.createSpan({ cls: "ts-git-metric-label", text: label });
    row.createSpan({ cls: "ts-git-metric-sub", text: sub });
  }

  private fillRecentDays(activity: DailyActivity[], days: number): DailyActivity[] {
    const map = new Map(activity.map(d => [d.date, d.count]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));
    const result: DailyActivity[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const date = localDateStr(d);
      result.push({ date, count: map.get(date) ?? 0 });
    }
    return result;
  }

  private activityLevel(count: number, max: number): number {
    if (count <= 0) return 0;
    const pct = count / Math.max(max, 1);
    if (pct <= .25) return 1;
    if (pct <= .5) return 2;
    if (pct <= .75) return 3;
    return 4;
  }

  private calendarMonthLabels(days: DailyActivity[]): Array<{ label: string; start: number; end: number }> {
    const labels: Array<{ label: string; start: number; end: number }> = [];
    let current = "";
    let start = 1;
    for (let i = 0; i < days.length; i++) {
      const [, month] = days[i].date.split("-");
      if (!current) {
        current = month;
        start = Math.floor(i / 7) + 1;
        continue;
      }
      if (month !== current) {
        labels.push({ label: `${Number(current)}月`, start, end: Math.floor(i / 7) + 1 });
        current = month;
        start = Math.floor(i / 7) + 1;
      }
    }
    if (current) labels.push({ label: `${Number(current)}月`, start, end: Math.floor((days.length - 1) / 7) + 2 });
    return labels;
  }

  // ── Workspaces
  private renderWorkspaces(parent: HTMLElement, stats: WorkspaceStats[]) {
    const grid = parent.createDiv({ cls: "ts-ws-grid" });
    const maxFiles = Math.max(...stats.map(s => s.fileCount), 1);
    for (const ws of stats) {
      const age  = Date.now() - ws.lastModified;
      const card = grid.createDiv({ cls: `ts-ws-card ${age < 7*86_400_000 ? "ts-ws--hot" : age < 30*86_400_000 ? "ts-ws--warm" : "ts-ws--cold"}` });
      card.addEventListener("click", () => this.openWorkspace(ws.dir));
      const top = card.createDiv({ cls: "ts-ws-top" });
      top.createSpan({ cls: "ts-ws-icon", text: ws.icon });
      top.createSpan({ cls: "ts-ws-name", text: ws.desc });
      card.createDiv({ cls: "ts-ws-count", text: `${ws.fileCount} 文件` });
      card.createDiv({ cls: "ts-ws-bar" }).createDiv({ cls: "ts-ws-fill", attr: { style: `width:${Math.round(ws.fileCount/maxFiles*100)}%` } });
      card.createDiv({ cls: "ts-ws-time", text: ws.lastModified ? `活跃 ${this.relTime(ws.lastModified)}` : "—" });
    }
  }

  private renderNextAction(
    parent: HTMLElement,
    today: TodayWorklog,
    missingLog: boolean,
    projectBacklog: ProjectBacklogItem[],
    execution: TodayExecutionModel,
  ) {
    const action = selectTodayNextAction({
      today,
      missingLog,
      projectBacklog,
      execution,
      todayLogPath: getTodayWorklogPath(),
    });
    const head = parent.createDiv({ cls: "ts-next-action-head" });
    head.createDiv({ cls: "ts-card-label", text: "下一步行动" });
    head.createDiv({ cls: `ts-next-action-badge ts-next-action-badge--${action.tone}`, text: action.badge });

    const body = parent.createDiv({ cls: "ts-next-action-body" });
    body.createDiv({ cls: "ts-next-action-title", text: action.title });
    body.createDiv({ cls: "ts-next-action-reason", text: action.reason });

    const foot = parent.createDiv({ cls: "ts-next-action-foot" });
    const riskRow = foot.createDiv({ cls: "ts-next-action-risks" });
    if (action.risks.length === 0) {
      riskRow.createSpan({ cls: "ts-next-action-risk ts-next-action-risk--quiet", text: "状态正常" });
    } else {
      for (const risk of action.risks) riskRow.createSpan({ cls: "ts-next-action-risk", text: risk });
    }

    const button = foot.createEl("button", { cls: `ts-next-action-btn ts-next-action-btn--${action.tone}`, text: action.button });
    button.addEventListener("click", async e => {
      e.stopPropagation();
      await this.runNextAction(action, button);
    });

    parent.addEventListener("click", () => {
      if (action.target === "project" && action.projectItem) this.openFile(action.projectItem.path);
      else void this.openTodayLog();
    });
  }

  private async runNextAction(action: NextAction, button: HTMLButtonElement) {
    if (action.target === "project" && action.projectItem) {
      const item = action.projectItem;
      this.confirmAndRunOperation(createPromoteBacklogOperationPreview(item), async () => {
        button.disabled = true;
        button.setText("加入中");
        await promoteProjectBacklogItemToToday(this.app, item);
        new Notice(`${item.project} 已加入今日 Todo`);
      });
      return;
    }
    await this.openTodayLog();
  }

  // ── Project backlog (from per-project 未完成事项.md)
  private renderProjectBacklog(parent: HTMLElement, items: ProjectBacklogItem[]) {
    if (items.length === 0) {
      parent.createDiv({ cls: "ts-empty", text: "暂无项目池事项" });
      return;
    }
    const list = parent.createDiv({ cls: "ts-backlog-list" });
    for (const item of items) this.renderProjectBacklogRow(list, item);
  }

  private renderProjectBacklogRow(parent: HTMLElement, item: ProjectBacklogItem) {
    const row = parent.createDiv({ cls: "ts-backlog-row" });
    const info = row.createDiv({ cls: "ts-backlog-info" });
    info.createDiv({ cls: "ts-backlog-project", text: item.project });
    info.createDiv({ cls: "ts-backlog-text", text: item.text });
    const actions = row.createDiv({ cls: "ts-backlog-actions" });
    const today = actions.createEl("button", { cls: "ts-backlog-btn ts-backlog-btn--primary", text: "今日" });
    today.addEventListener("click", async () => {
      this.confirmAndRunOperation(createPromoteBacklogOperationPreview(item), async () => {
        today.disabled = true;
        today.setText("加入中");
        await promoteProjectBacklogItemToToday(this.app, item);
        new Notice(`${item.project} 已加入今日 Todo`);
      });
    });
    const open = actions.createEl("button", { cls: "ts-backlog-btn", text: "打开" });
    open.addEventListener("click", () => this.openFile(item.path));
  }

  // ── Todos (from today's worklog ## 今日Todo)
  private renderTodos(parent: HTMLElement, items: TodoItem[]) {
    const pending = items.filter(t => !t.done);
    const done    = items.filter(t => t.done);

    if (items.length === 0) {
      parent.createDiv({ cls: "ts-empty", text: "暂无 Todo，点击“记TODO”添加" });
      return;
    }
    const list = parent.createDiv({ cls: "ts-todo-list" });
    for (const item of [...pending, ...done]) this.renderTodoRow(list, item);
  }

  private todoDisplayParts(text: string): { project: string | null; body: string } {
    const match = text.match(/^([A-Za-z0-9_\-\u4e00-\u9fa5]{2,32})[：:]\s*(.+)$/);
    if (!match) return { project: null, body: text };
    return { project: match[1], body: match[2] };
  }

  private async copyTextToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      new Notice(successMessage);
    } catch {
      new Notice("复制失败，请手动打开今日日志复制");
    }
  }

  private async copyTodoText(item: TodoItem) {
    await this.copyTextToClipboard(item.text, "已复制 Todo");
  }

  private async copyPendingTodos(items: TodoItem[]) {
    const pending = items.filter(item => !item.done);
    if (pending.length === 0) {
      new Notice("没有待复制的未完成 Todo");
      return;
    }
    const text = pending.map(item => `- [ ] ${item.text}`).join("\n");
    await this.copyTextToClipboard(text, `已复制 ${pending.length} 个 Todo`);
  }

  private renderTodoRow(parent: HTMLElement, item: TodoItem) {
    const row = parent.createDiv({ cls: `ts-todo-row${item.done ? " ts-todo-done" : ""}` });
    const chk = row.createEl("button", {
      cls: "ts-todo-chk",
      attr: { "aria-label": item.done ? "标记为未完成" : "标记为完成" },
    });
    setIcon(chk, item.done ? "check-square" : "square");
    const content = row.createDiv({ cls: "ts-todo-content" });
    const renderTodoText = () => {
      const display = this.todoDisplayParts(item.text);
      content.empty();
      if (display.project) content.createSpan({ cls: "ts-todo-project", text: display.project });
      content.createSpan({ cls: "ts-todo-txt", text: display.body });
    };
    renderTodoText();

    const copy = row.createEl("button", {
      cls: "ts-todo-copy-btn ts-todo-row-copy",
      attr: { "aria-label": "复制 Todo", title: "复制 Todo" },
    });
    setIcon(copy, "copy");
    copy.addEventListener("click", e => {
      e.stopPropagation();
      void this.copyTodoText(item);
    });
    copy.addEventListener("dblclick", e => e.stopPropagation());

    // checkbox 单击 = 切换完成状态（原地更新，无全页刷新）
    chk.addEventListener("click", async e => {
      e.stopPropagation();
      const nextDone = !item.done;
      this.confirmAndRunOperation(createTodoToggleOperationPreview(item, nextDone), async () => {
        await toggleTodoInWorklog(this.app, { ...item, done: nextDone });
        new Notice(nextDone ? "Todo 已归档到今日产出" : "Todo 已恢复为未完成");
      });
    });

    // 单击行 = 打开文件（detail >= 2 时忽略，让 dblclick 接管）
    row.addEventListener("click", e => {
      if ((e as MouseEvent).detail >= 2) return;
      this.openFile(getTodayWorklogPath());
    });

    // 双击行 = inline 编辑文字
    row.addEventListener("dblclick", e => {
      e.stopPropagation();
      // 替换文字 span 为 input
      const input = document.createElement("input");
      input.type  = "text";
      input.value = item.text;
      input.className = "ts-todo-edit-input";
      content.empty();
      content.appendChild(input);
      input.focus();
      input.select();

      // 阻止 input 上的所有点击冒泡到 row，防止触发 openFile
      input.addEventListener("click",     e => e.stopPropagation());
      input.addEventListener("mousedown", e => e.stopPropagation());

      let saved = false;
      const save = async () => {
        if (saved) return;
        saved = true;
        const newText = input.value.trim();
        if (newText && newText !== item.text) {
          this.confirmAndRunOperation(createTodoRenameOperationPreview(item, newText), async () => {
            await renameTodoInWorklog(this.app, item, newText);
            item.text = newText;
            new Notice("Todo 已重命名");
          });
        }
        // 原地恢复任务展示，无全页刷新
        renderTodoText();
      };

      input.addEventListener("keydown", async ev => {
        if (ev.key === "Enter")  { ev.preventDefault(); await save(); }
        if (ev.key === "Escape") {
          saved = true;
          // 取消：原地恢复任务展示
          renderTodoText();
        }
      });
      input.addEventListener("blur", save);
    });
  }

  // ── Today: ## 今日重点 + metrics + event stream ──
  private emptyTodayWorklog(): TodayWorklog {
    return { highlights: [], todos: [], entries: [], outputs: [], events: [], timeline: [] };
  }

  private renderTodayWorklog(
    parent: HTMLElement,
    today: TodayWorklog,
    missingLog = false,
    focusCoverage?: TodayFocusCoverage,
    todayExecution?: TodayExecutionModel,
  ) {
    const body = parent.createDiv({ cls: "ts-log-body ts-log-body--split" });
    const openToday = () => this.openTodayLog();

    const focusCard = body.createDiv({ cls: "ts-today-subcard ts-today-subcard--focus" });
    focusCard.createDiv({ cls: "ts-today-subhead", text: "今日重点" });
    const focusBody = focusCard.createDiv({ cls: "ts-today-scroll" });
    if (missingLog) {
      const init = focusBody.createEl("button", { cls: "ts-today-init" });
      init.createSpan({ cls: "ts-today-init-title", text: "创建今天工作日志" });
      init.createSpan({ cls: "ts-today-init-sub", text: getTodayWorklogPath() });
      init.addEventListener("click", openToday);
    } else if (today.highlights.length === 0) {
      focusBody.createDiv({ cls: "ts-empty ts-today-empty", text: "暂无今日重点" });
    } else {
      const hl = focusBody.createDiv({ cls: "ts-log-highlights" });
      for (const h of today.highlights) {
        const row = hl.createDiv({ cls: "ts-log-highlight-row" });
        row.addEventListener("click", openToday);
        row.createSpan({ cls: "ts-log-hl-bullet", text: "◆" });
        row.createSpan({ cls: "ts-log-hl-text",   text: h });
      }
    }

    const metricsCard = body.createDiv({ cls: "ts-today-subcard ts-today-subcard--metrics" });
    metricsCard.createDiv({ cls: "ts-today-subhead", text: "今日指标" });
    this.renderTodayMetrics(metricsCard, today, missingLog, focusCoverage);

    if (todayExecution) {
      const execCard = body.createDiv({ cls: "ts-today-subcard ts-today-subcard--execution" });
      renderTodayExecution(execCard, todayExecution, { openToday });
    }

    const flowCard = body.createDiv({ cls: "ts-today-subcard ts-today-subcard--flow" });
    const flowHead = flowCard.createDiv({ cls: "ts-today-subhead ts-timeline-head" });
    flowHead.createSpan({ cls: "ts-timeline-head-title", text: "时间线 / 产出" });
    this.renderTimelineFilters(flowHead, today.timeline);
    const flowBody = flowCard.createDiv({ cls: "ts-today-scroll" });

    const visibleTimeline = today.timeline.filter(item =>
      this.timelineFilter === "all" || item.kind === this.timelineFilter
    );
    if (visibleTimeline.length > 0) {
      const list = flowBody.createDiv({ cls: "ts-timeline-list" });
      for (const item of visibleTimeline) this.renderTimelineItem(list, item);
    } else if (today.timeline.length > 0) {
      flowBody.createDiv({ cls: "ts-empty ts-today-empty", text: "当前筛选暂无内容" });
    } else {
      flowBody.createDiv({ cls: "ts-empty ts-today-empty", text: missingLog ? "今日日志创建后显示记录/产出" : "暂无记录" });
    }
  }

  private renderTodayMetrics(
    parent: HTMLElement,
    today: TodayWorklog,
    missingLog = false,
    focusCoverage?: TodayFocusCoverage,
  ) {
    const metrics = this.calculateTodayMetrics(today);
    const body = parent.createDiv({ cls: "ts-today-scroll ts-today-metrics-body" });
    const openToday = () => this.openTodayLog();

    const grid = body.createDiv({ cls: "ts-today-metric-grid" });
    const tiles: Array<{ label: string; value: string; tone?: string }> = [
      { label: "承诺", value: String(metrics.total) },
      { label: "待完成", value: String(metrics.pending), tone: metrics.pending > 0 ? "active" : "quiet" },
      { label: "完成", value: String(metrics.done), tone: metrics.done > 0 ? "good" : "quiet" },
      { label: "产出", value: String(metrics.outputs), tone: metrics.outputs > 0 ? "good" : "quiet" },
      { label: "Git", value: String(metrics.git), tone: metrics.git > 0 ? "good" : "quiet" },
      { label: "Agent", value: String(metrics.agent), tone: metrics.agent > 0 ? "active" : "quiet" },
      { label: "项目", value: String(metrics.projects), tone: metrics.projects > 0 ? "active" : "quiet" },
      { label: "阻塞", value: String(metrics.blocked), tone: metrics.blocked > 0 ? "warn" : "quiet" },
    ];

    for (const tile of tiles) {
      const item = grid.createDiv({ cls: `ts-today-metric ts-today-metric--${tile.tone ?? "quiet"}` });
      item.addEventListener("click", openToday);
      item.createDiv({ cls: "ts-today-metric-value", text: tile.value });
      item.createDiv({ cls: "ts-today-metric-label", text: tile.label });
    }

    const focus = body.createDiv({ cls: `ts-today-focus${metrics.blocked > 0 ? " ts-today-focus--warn" : ""}` });
    focus.addEventListener("click", openToday);
    focus.createDiv({ cls: "ts-today-focus-label", text: metrics.blocked > 0 ? "阻塞提示" : "当前焦点" });
    if (missingLog) {
      focus.createDiv({ cls: "ts-today-focus-text", text: "创建今日日志后显示指标" });
    } else if (metrics.blocked > 0) {
      focus.createDiv({ cls: "ts-today-focus-text", text: `${metrics.blocked} 个活跃阻塞` });
    } else if (metrics.focus) {
      focus.createDiv({ cls: "ts-today-focus-text", text: metrics.focus.text });
    } else {
      focus.createDiv({ cls: "ts-today-focus-text", text: metrics.total > 0 ? "今日 Todo 已完成" : "暂无今日 Todo" });
    }

    if (focusCoverage) renderTodayFocusStrip(body, focusCoverage);
  }

  private calculateTodayMetrics(today: TodayWorklog): TodayMetrics {
    const pendingTodos = today.todos.filter(todo => !todo.done);
    return {
      total: today.todos.length,
      pending: pendingTodos.length,
      done: today.todos.filter(todo => todo.done).length,
      outputs: today.timeline.filter(item => item.kind === "output").length,
      git: today.timeline.filter(item => item.kind === "git").length,
      agent: today.timeline.filter(item => item.kind === "agent").length,
      projects: this.extractProjectNames(today).size,
      blocked: this.countBlockedItems(today),
      focus: pendingTodos[0],
    };
  }

  private calculateNextAction(today: TodayWorklog, missingLog: boolean, projectBacklog: ProjectBacklogItem[]): NextAction {
    const metrics = this.calculateTodayMetrics(today);
    const blocked = this.blockedTextsFromToday(today);
    const risks = this.nextActionRisks(today, metrics, blocked);
    const firstPending = today.todos.find(todo => !todo.done);

    if (missingLog) {
      return {
        tone: "missing",
        badge: "启动",
        title: "创建今天工作日志",
        reason: getTodayWorklogPath(),
        button: "创建",
        target: "today",
        risks,
      };
    }

    if (blocked.length > 0) {
      return {
        tone: "warn",
        badge: "阻塞",
        title: blocked[0],
        reason: `${blocked.length} 个活跃阻塞`,
        button: "打开",
        target: "today",
        risks,
      };
    }

    if (firstPending) {
      return {
        tone: "todo",
        badge: "今日Todo",
        title: firstPending.text,
        reason: `${metrics.pending} 个今日 Todo 待完成`,
        button: "打开",
        target: "today",
        risks,
      };
    }

    if (projectBacklog.length > 0) {
      const item = projectBacklog[0];
      return {
        tone: "pool",
        badge: item.project,
        title: item.text,
        reason: "没有待完成 Todo，可以从项目池拉入一项",
        button: "加入今日",
        target: "project",
        projectItem: item,
        risks,
      };
    }

    if (today.timeline.length > 0 && !this.todayHasOutput(today)) {
      return {
        tone: "summary",
        badge: "总结",
        title: "补写今日产出",
        reason: "今天已有记录，但还没有产出条目",
        button: "写总结",
        target: "today",
        risks,
      };
    }

    return {
      tone: "idle",
      badge: "启动",
      title: "设定今日重点",
      reason: "没有未完成 Todo 或项目池候选",
      button: "打开",
      target: "today",
      risks,
    };
  }

  private blockedTextsFromToday(today: TodayWorklog): string[] {
    const values = [
      ...today.todos.map(todo => todo.text),
      ...today.timeline.flatMap(item => [item.title, item.subtitle ?? "", item.raw]),
    ];
    return values.filter(text => this.isActiveBlockedText(text));
  }

  private todayHasOutput(today: TodayWorklog): boolean {
    return today.timeline.some(item => item.kind === "output");
  }

  private todayHasGit(today: TodayWorklog): boolean {
    return today.timeline.some(item => item.kind === "git");
  }

  private nextActionRisks(today: TodayWorklog, metrics: TodayMetrics, blocked: string[]): string[] {
    const risks: string[] = [];
    if (blocked.length > 0) risks.push(`${blocked.length} 阻塞`);
    if (metrics.pending >= 5) risks.push(`${metrics.pending} 待办`);
    if (!this.todayHasOutput(today)) risks.push("无产出");
    if (!this.todayHasGit(today)) risks.push("无 Git");
    return risks.slice(0, 3);
  }

  private extractProjectNames(today: TodayWorklog): Set<string> {
    const names = new Set<string>();
    for (const todo of today.todos) {
      const name = this.projectNameFromText(todo.text);
      if (name) names.add(name);
    }
    for (const item of today.timeline) {
      for (const text of [item.title, item.subtitle, item.raw]) {
        const name = this.projectNameFromText(text ?? "");
        if (name) names.add(name);
      }
    }
    return names;
  }

  private projectNameFromText(text: string): string | null {
    const trimmed = text.trim();
    const prefix = trimmed.match(/^([A-Za-z0-9_\-\u4e00-\u9fa5]{2,32})[：:]/);
    if (prefix) return prefix[1];
    const dotted = trimmed.match(/^([A-Za-z0-9_\-\u4e00-\u9fa5]{2,32})\s+·\s+/);
    if (dotted) return dotted[1];
    return null;
  }

  private countBlockedItems(today: TodayWorklog): number {
    return this.blockedTextsFromToday(today).length;
  }

  private isActiveBlockedText(text: string): boolean {
    return this.isBlockedText(text) && !this.isResolvedBlockedText(text);
  }

  private isBlockedText(text: string): boolean {
    return /(^|[\s\-*◆：:])(?:阻塞|等待|卡住)\s*[：:]|(^|[\s\-*◆：:])blocked\s*(?::|by\b)/i.test(text);
  }

  private isResolvedBlockedText(text: string): boolean {
    if (/已解决|已解除|已处理|✅/i.test(text)) return true;
    if (/未完成|没完成|没有完成|尚未完成/.test(text)) return false;
    return /完成/.test(text);
  }

  private renderTimelineFilters(parent: HTMLElement, items: TimelineItem[]) {
    const filters: Array<{ value: TimelineFilter; label: string; count: number }> = [
      { value: "all", label: "全部", count: items.length },
      { value: "record", label: "记录", count: items.filter(item => item.kind === "record").length },
      { value: "output", label: "产出", count: items.filter(item => item.kind === "output").length },
      { value: "agent", label: "Agent", count: items.filter(item => item.kind === "agent").length },
      { value: "git", label: "Git", count: items.filter(item => item.kind === "git").length },
    ];

    const wrap = parent.createDiv({ cls: "ts-timeline-filters" });
    for (const filter of filters) {
      const btn = wrap.createEl("button", {
        cls: `ts-timeline-filter${this.timelineFilter === filter.value ? " is-active" : ""}`,
      });
      btn.setAttribute("aria-pressed", this.timelineFilter === filter.value ? "true" : "false");
      btn.createSpan({ cls: "ts-timeline-filter-label", text: filter.label });
      btn.createSpan({ cls: "ts-timeline-filter-count", text: String(filter.count) });
      btn.addEventListener("click", ev => {
        ev.stopPropagation();
        this.timelineFilter = filter.value;
        void this.render();
      });
    }
  }

  private renderTimelineItem(parent: HTMLElement, item: TimelineItem) {
    const summary = this.timelineSummaryForItem(item);
    const row = parent.createDiv({ cls: `ts-timeline-row ts-timeline-row--${item.kind}` });
    row.addEventListener("click", () => this.openTimelineItem(item));

    row.createDiv({ cls: "ts-timeline-rail" });

    const copy = row.createDiv({ cls: "ts-timeline-copy" });
    const top = copy.createDiv({ cls: "ts-timeline-top" });
    top.createSpan({ cls: "ts-timeline-badge", text: item.badge });
    top.createSpan({ cls: "ts-timeline-time", text: item.time || "----" });

    copy.createDiv({ cls: "ts-timeline-title", text: item.title });
    if (summary.summary) copy.createDiv({ cls: "ts-timeline-summary", text: summary.summary });

    if (summary.chips.length > 0) {
      const chips = copy.createDiv({ cls: "ts-timeline-chips" });
      for (const chip of summary.chips) chips.createSpan({ cls: "ts-timeline-chip", text: chip });
    }
  }

  private timelineSummaryForItem(item: TimelineItem): TimelineSummary {
    return {
      summary: this.timelineSummaryText(item),
      chips: this.timelineChipsForItem(item).slice(0, 2),
    };
  }

  private timelineSummaryText(item: TimelineItem): string {
    const lines = [item.subtitle ?? "", ...item.body, item.raw]
      .map(text => this.compactTimelineText(text))
      .filter(Boolean);
    const title = this.compactTimelineText(item.title);
    return lines.find(text => text !== title) ?? "";
  }

  private timelineChipsForItem(item: TimelineItem): string[] {
    const chips: string[] = [];
    if (item.kind === "git" && item.subtitle) {
      const parts = item.subtitle.split(" · ").map(part => part.trim()).filter(Boolean);
      if (parts[0]) chips.push(parts[0]);
      const filePart = parts.find(part => /\d+\s+files?|no file list/i.test(part));
      if (filePart) chips.push(filePart.replace(" files", " 文件").replace("no file list", "无文件列表"));
    }
    if (item.kind === "agent") {
      const verification = this.compactTimelineText(item.raw).match(/验证[：:][^。；;]+/)?.[0];
      if (verification) chips.push(verification);
    }
    if (item.kind === "output" && item.badge) chips.push(item.badge);
    if (item.targetPath) {
      const pathChip = this.timelineChipFromPath(item.targetPath);
      if (pathChip) chips.push(pathChip);
    }
    if (chips.length === 0 && item.kind === "record") chips.push("记录");
    return Array.from(new Set(chips.filter(Boolean)));
  }

  private timelineChipFromPath(path: string): string {
    const parts = path.split("/").filter(Boolean);
    return parts.at(-1) ?? path;
  }

  private compactTimelineText(text: string): string {
    return text
      .replace(/`/g, "")
      .replace(/^-+\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/^(为什么做|怎么做的|改了什么)[：:]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private async openTimelineItem(item: TimelineItem) {
    if (item.targetPath) {
      const target = this.resolveTimelineTarget(item.targetPath, item.sourcePath);
      if (target) {
        await this.app.workspace.getLeaf(false).openFile(target);
        return;
      }
    }
    await this.openFile(item.sourcePath || getTodayWorklogPath());
  }

  private resolveTimelineTarget(rawTarget: string, sourcePath: string): TFile | null {
    if (/^https?:\/\//i.test(rawTarget)) return null;
    const target = this.cleanTimelineTarget(rawTarget);
    const direct = this.app.vault.getAbstractFileByPath(target) as TFile | null;
    if (direct) return direct;

    const withMd = target.endsWith(".md") ? target : `${target}.md`;
    const mdFile = this.app.vault.getAbstractFileByPath(withMd) as TFile | null;
    if (mdFile) return mdFile;

    const linkPath = target.replace(/\.md$/i, "");
    return this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath) as TFile | null;
  }

  private cleanTimelineTarget(rawTarget: string): string {
    let target = rawTarget.trim().replace(/^<|>$/g, "").split("#")[0];
    try { target = decodeURIComponent(target); } catch {}
    target = target.replace(/^file:\/\//, "");
    const vaultRoot = "/Volumes/资料/projects/thirdspace/rain/";
    if (target.startsWith(vaultRoot)) target = target.slice(vaultRoot.length);
    return target.replace(/^\.\/+/, "").replace(/^\/+/, "");
  }

  private renderInlineMore(parent: HTMLElement, count: number) {
    if (count <= 0) return;
    const more = parent.createDiv({ cls: "ts-inline-more", text: `+ ${count} more` });
    more.addEventListener("click", () => this.openFile(getTodayWorklogPath()));
  }

  // ── Products
  private renderProducts(
    parent: HTMLElement,
    products: ReturnType<typeof parseProducts>,
    discovery: ProjectDiscoverySummary,
    onboarding: ProjectOnboardingItem[],
  ) {
    const onboardingPending = onboarding.filter(item => item.needsOnboarding);
    if (products.length === 0 && discovery.pending.length === 0 && onboardingPending.length === 0 && !discovery.error) {
      parent.createDiv({ cls: "ts-empty", text: "暂无系统或收件箱状态" });
      return;
    }

    const ICONS: Record<string, string> = { active:"●", watch:"◐", paused:"○" };
    if (products.length > 0) {
      const list = parent.createDiv({ cls: "ts-prod-list" });
      const visible = products.slice(0, this.singleScreenLimit.products);
      for (const p of visible) {
        const row = list.createDiv({ cls: `ts-prod-row ts-prod--${p.status}` });
        row.createSpan({ cls: "ts-prod-dot", text: ICONS[p.status]??"·" });
        const info = row.createDiv({ cls: "ts-prod-info" });
        info.createDiv({ cls: "ts-prod-name", text: p.name });
        if (p.milestone) info.createDiv({ cls: "ts-prod-mile", text: p.milestone });
      }
      if (products.length > visible.length) list.createDiv({ cls: "ts-inline-more", text: `+ ${products.length - visible.length} 个产品` });
    }

    this.renderProjectDiscovery(parent, discovery, onboardingPending);
  }

  private renderProjectDiscovery(parent: HTMLElement, discovery: ProjectDiscoverySummary, onboarding: ProjectOnboardingItem[]) {
    if (discovery.error) {
      const warn = parent.createDiv({ cls: "ts-discovery-box ts-discovery-box--warn" });
      warn.createDiv({ cls: "ts-discovery-kicker", text: "系统 / 收件箱" });
      warn.createDiv({ cls: "ts-discovery-title", text: "项目发现扫描异常" });
      warn.createDiv({ cls: "ts-discovery-path", text: discovery.error });
      return;
    }
    if (discovery.pending.length > 0) {
      const box = parent.createDiv({ cls: "ts-discovery-box" });
      const head = box.createDiv({ cls: "ts-discovery-head" });
      const copy = head.createDiv({ cls: "ts-discovery-copy" });
      copy.createDiv({ cls: "ts-discovery-kicker", text: "系统 / 收件箱" });
      copy.createDiv({ cls: "ts-discovery-title", text: `${discovery.pending.length} 个新项目待确认` });
      const openBtn = head.createEl("button", { cls: "ts-discovery-open", text: "打开确认单" });
      openBtn.addEventListener("click", () => this.openFile(discovery.notePath));

      const list = box.createDiv({ cls: "ts-discovery-list" });
      for (const candidate of discovery.pending.slice(0, 3)) this.renderCandidateRow(list, candidate);
      if (discovery.pending.length > 3) {
        const more = list.createDiv({ cls: "ts-inline-more", text: `+ ${discovery.pending.length - 3} 个候选` });
        more.addEventListener("click", () => this.openFile(discovery.notePath));
      }
    }

    if (onboarding.length > 0) this.renderProjectOnboarding(parent, onboarding);
  }

  private renderCandidateRow(parent: HTMLElement, candidate: ProjectCandidate) {
    const row = parent.createDiv({ cls: "ts-discovery-row" });
    const info = row.createDiv({ cls: "ts-discovery-info" });
    info.createDiv({ cls: "ts-discovery-name", text: candidate.name });
    info.createDiv({ cls: "ts-discovery-path", text: candidate.path });
    info.createDiv({ cls: "ts-discovery-markers", text: candidate.markers.join(" · ") });

    const actions = row.createDiv({ cls: "ts-discovery-actions" });
    const accept = actions.createEl("button", { cls: "ts-discovery-btn ts-discovery-btn--primary", text: "纳入" });
    accept.addEventListener("click", async () => {
      this.confirmAndRunOperation(createDiscoveryCandidateOperationPreview(candidate, "accept"), async () => {
        const accepted = await acceptProjectCandidate(this.app, candidate.id);
        new Notice(accepted ? `已纳入 ${candidate.name}` : `未找到待确认项目：${candidate.name}`);
      });
    });

    const ignore = actions.createEl("button", { cls: "ts-discovery-btn", text: "忽略" });
    ignore.addEventListener("click", async () => {
      this.confirmAndRunOperation(createDiscoveryCandidateOperationPreview(candidate, "ignore"), async () => {
        const ignored = await ignoreProjectCandidate(this.app, candidate.id);
        new Notice(ignored ? `已忽略 ${candidate.name}` : `未找到待确认项目：${candidate.name}`);
      });
    });
  }

  private renderProjectOnboarding(parent: HTMLElement, onboarding: ProjectOnboardingItem[]) {
    const box = parent.createDiv({ cls: "ts-discovery-box ts-discovery-box--onboarding" });
    const head = box.createDiv({ cls: "ts-discovery-head" });
    const copy = head.createDiv({ cls: "ts-discovery-copy" });
    copy.createDiv({ cls: "ts-discovery-kicker", text: "项目接入" });
    copy.createDiv({ cls: "ts-discovery-title", text: `${onboarding.length} 个项目待接入` });

    const list = box.createDiv({ cls: "ts-discovery-list" });
    for (const item of onboarding.slice(0, 4)) {
      const row = list.createDiv({ cls: "ts-discovery-row" });
      const info = row.createDiv({ cls: "ts-discovery-info" });
      info.createDiv({ cls: "ts-discovery-name", text: item.name });
      info.createDiv({ cls: "ts-discovery-path", text: item.repoPath });
      info.createDiv({ cls: "ts-discovery-markers", text: item.reason });

      const actions = row.createDiv({ cls: "ts-discovery-actions" });
      const connect = actions.createEl("button", { cls: "ts-discovery-btn ts-discovery-btn--primary", text: "接入" });
      connect.addEventListener("click", async () => {
        this.confirmAndRunOperation(createOnboardingOperationPreview(item), async () => {
          connect.disabled = true;
          connect.setText("接入中");
          const result = await runProjectOnboarding(this.app, item.id);
          if (result) {
            new Notice(`${item.name} 接入完成：hook=${result.hookStatus}，history=${result.historyStatus}`);
          } else {
            new Notice(`未找到待接入项目：${item.name}`);
          }
        });
      });
    }
    if (onboarding.length > 4) list.createDiv({ cls: "ts-inline-more", text: `+ ${onboarding.length - 4} 个接入项` });
  }

  private renderProjectMaterialsCard(parent: HTMLElement, materials: ProjectMaterialsItem[]) {
    if (materials.length === 0) {
      parent.createDiv({ cls: "ts-empty", text: "暂无项目资料" });
      return;
    }

    const pending = materials.filter(item => item.needsImport);
    const synced = materials.length - pending.length;
    const summary = parent.createDiv({ cls: "ts-material-summary" });
    summary.createDiv({ cls: `ts-material-pill ${pending.length > 0 ? "ts-material-pill--warn" : "ts-material-pill--ok"}`, text: `${synced}真实/${materials.length}总数 已索引` });
    summary.createDiv({ cls: "ts-material-pill", text: pending.length > 0 ? `${pending.length} 待导入` : "仅索引" });

    const list = parent.createDiv({ cls: "ts-material-list" });
    const visible = materials.slice(0, this.singleScreenLimit.materials);
    for (const item of visible) this.renderProjectMaterialRow(list, item);
    if (materials.length > visible.length) {
      list.createDiv({ cls: "ts-inline-more", text: `+ ${materials.length - visible.length} 个资料项目` });
    }
  }

  private renderProjectMaterialRow(parent: HTMLElement, item: ProjectMaterialsItem) {
    const row = parent.createDiv({ cls: `ts-material-row ${item.needsImport ? "ts-material-row--pending" : "ts-material-row--synced"}` });
    const info = row.createDiv({ cls: "ts-material-info" });
    const top = info.createDiv({ cls: "ts-material-top" });
    top.createSpan({ cls: "ts-material-name", text: item.name });
    top.createSpan({ cls: "ts-material-count", text: `${item.importedCount}/${item.candidateCount}` });
    info.createDiv({ cls: "ts-material-path", text: item.repoPath });
    info.createDiv({ cls: "ts-material-reason", text: item.reason });

    const actions = row.createDiv({ cls: "ts-material-actions" });
    if (item.indexExists) {
      const open = actions.createEl("button", { cls: "ts-material-btn", text: "打开" });
      open.addEventListener("click", () => this.openFile(item.indexPath));
    }
    const importBtn = actions.createEl("button", {
      cls: `ts-material-btn ${item.needsImport ? "ts-material-btn--primary" : ""}`,
      text: item.needsImport ? (item.importedCount > 0 ? "更新索引" : "建索引") : "重扫索引",
    });
    importBtn.addEventListener("click", async () => {
      this.confirmAndRunOperation(createMaterialsOperationPreview(item), async () => {
        importBtn.disabled = true;
        importBtn.setText(item.needsImport ? "索引中" : "重扫中");
        const result = await runProjectMaterialsImport(this.app, item.id);
        if (result) {
          new Notice(`${item.name} 资料索引完成：${result.indexedCount} 文件，快照 0`);
        } else {
          new Notice(`未找到资料索引项目：${item.name}`);
        }
      });
    });
  }

  // ── Quick actions
  private renderActions(parent: HTMLElement) {
    const ACTIONS = [
      { label: "新笔记",  icon: "square-pen", fn: () => this.createNewNote() },
      { label: "今日志",  icon: "calendar-clock", fn: () => this.openTodayLog() },
      { label: "记TODO",  icon: "list-todo", fn: () => this.openTodoModal() },
      { label: "搜索",    icon: "search", fn: () => this.runCmd("global-search:open") },
      { label: "收件箱",  icon: "inbox", fn: () => this.openWorkspace("01-收件箱") },
    ];
    const grid = parent.createDiv({ cls: "ts-act-grid" });
    for (const a of ACTIONS) {
      const btn = grid.createEl("button", { cls: "ts-act-btn", attr: { title: a.label } });
      const icon = btn.createDiv({ cls: "ts-act-icon" });
      setIcon(icon, a.icon);
      btn.createDiv({ cls: "ts-act-label", text: a.label });
      btn.addEventListener("click", a.fn);
    }
  }

  // ── Recent
  private renderRecent(parent: HTMLElement, files: RecentFile[]) {
    if (files.length === 0) {
      parent.createDiv({ cls: "ts-empty", text: "No recent files" });
      return;
    }

    const list = parent.createDiv({ cls: "ts-rec-list" });
    for (const f of files) {
      const row = list.createDiv({ cls: "ts-rec-row" });
      row.addEventListener("click", () => this.openFile(f.path));
      row.createSpan({ cls: "ts-rec-ws",   text: f.workspace.replace(/^\d+-/,"") });
      const copy = row.createDiv({ cls: "ts-rec-copy" });
      copy.createDiv({ cls: "ts-rec-name", text: f.name });
      copy.createDiv({ cls: "ts-rec-path", text: f.path });
      row.createSpan({ cls: "ts-rec-time", text: this.relTime(f.mtime) });
    }
  }

  // ── Helpers
  private calcStreak(activity: {date:string;count:number}[]): number {
    const set = new Set(activity.filter(a=>a.count>0).map(a=>a.date));
    let streak = 0; const d = new Date();
    while (true) { const s = localDateStr(d); if (!set.has(s)) break; streak++; d.setDate(d.getDate()-1); }
    return streak;
  }
  private relTime(ms: number): string {
    const d = Math.floor((Date.now()-ms)/86_400_000);
    if (d===0) return "今天"; if (d===1) return "1天";
    if (d<7) return `${d}天`; if (d<30) return `${Math.floor(d/7)}周`;
    return `${Math.floor(d/30)}个月`;
  }
  private async openFile(path: string) {
    const f = this.app.vault.getAbstractFileByPath(path) as TFile|null;
    if (f) await this.app.workspace.getLeaf(false).openFile(f);
  }
  private showTodoArchiveToast(text: string) {
    const existing = this.contentEl.querySelector<HTMLElement>(".ts-flow-toast");
    if (existing) existing.remove();

    const toast = this.contentEl.createDiv({ cls: "ts-flow-toast" });
    toast.createSpan({ cls: "ts-flow-dot", text: "" });
    const copy = toast.createDiv({ cls: "ts-flow-copy" });
    copy.createDiv({ cls: "ts-flow-title", text: "已归档到今日产出" });
    copy.createDiv({ cls: "ts-flow-text", text });
    window.setTimeout(() => toast.addClass("is-leaving"), 1200);
    window.setTimeout(() => toast.remove(), 1800);
  }
  private openWorkspace(dir: string) {
    const fe = (this.app as any).internalPlugins?.plugins?.["file-explorer"]?.instance;
    const folder = this.app.vault.getAbstractFileByPath(dir);
    if (fe && folder) { fe.revealInFolder(folder); try { fe.setCollapseState?.(folder,false); } catch {} }
    const first = this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(dir+"/") && !f.path.includes("WORKSPACE") && !f.path.includes("AGENTS"))
      .sort((a,b) => b.stat.mtime - a.stat.mtime)[0];
    if (first) this.openFile(first.path);
  }
  private async createNewNote() {
    const now = new Date();
    const date = localDateCompact(now);
    const ts   = localTimestamp(now);
    const path = `01-收件箱/${date}_untitled.md`;
    const fm   = ["---",`title: "Untitled"`,`type: note`,`topic: work`,`workspace: "01-收件箱"`,`created: "${ts}"`,`modified: "${ts}"`,`tags: ["note","draft"]`,`source: manual`,`status: draft`,"---","",""].join("\n");
    const existing = this.app.vault.getAbstractFileByPath(path) as TFile | null;
    if (existing) {
      await this.app.workspace.getLeaf(false).openFile(existing);
      return;
    }
    this.confirmAndRunOperation(createNewNoteOperationPreview(path, fm), async () => {
      try {
        const f = await this.app.vault.create(path, fm);
        await this.app.workspace.getLeaf(false).openFile(f);
      } catch {
        const f = this.app.vault.getAbstractFileByPath(path) as TFile|null;
        if (f) await this.app.workspace.getLeaf(false).openFile(f);
      }
    }, { refresh: false });
  }
  private async openTodayLog() {
    const path = getTodayWorklogPath();
    const existing = this.app.vault.getAbstractFileByPath(path) as TFile | null;
    if (existing) {
      await this.app.workspace.getLeaf(false).openFile(existing);
      return;
    }
    this.confirmAndRunOperation(createTodayWorklogOperationPreview(path), async () => {
      const f = await ensureTodayWorklog(this.app);
      await this.app.workspace.getLeaf(false).openFile(f);
    }, { refresh: false });
  }
  private openTodoModal() {
    new TodoModal(this.app, async (text) => {
      this.confirmAndRunOperation(createTodoAddOperationPreview(text), async () => {
        await addTodoToWorklog(this.app, text);
        new Notice("Todo 已加入今日工作日志");
      });
    }).open();
  }

  private confirmAndApplyWrite(preview: ControlledWritePreview) {
    new WritePreviewModal(this.app, preview, async () => {
      await this.applyPreview(preview);
      await this.render();
    }).open();
  }

  private confirmAndApplyWrites(previews: ControlledWritePreview[]) {
    const [first, ...rest] = previews;
    if (!first) return;
    new WritePreviewModal(this.app, first, async () => {
      await this.applyPreview(first);
      if (rest.length > 0) {
        window.setTimeout(() => this.confirmAndApplyWrites(rest), 0);
      } else {
        await this.render();
      }
    }).open();
  }

  private confirmAndRunOperation(
    preview: ControlledWritePreview,
    operation: () => Promise<void>,
    options: { refresh?: boolean } = {},
  ) {
    new WritePreviewModal(this.app, preview, async () => {
      await operation();
      if (options.refresh ?? true) await this.render();
    }).open();
  }

  private async applyPreview(preview: ControlledWritePreview) {
    const current = await this.app.vault.adapter.read(preview.path).catch(() => preview.before);
    const next = applyControlledWritePreview(preview, current);
    const file = this.app.vault.getAbstractFileByPath(preview.path) as TFile | null;
    if (file) {
      await this.app.vault.modify(file, next);
    } else {
      await this.app.vault.create(preview.path, next);
    }
    new Notice("ThirdSpace Dashboard：写入完成");
  }

  private async openProjectDetailActionModal(
    portfolio: PortfolioModel,
    projectId: string,
    action: ProjectDetailAction,
  ) {
    const project = portfolio.projects.find(item => item.id === projectId);
    if (!project || !project.statusNote || project.lifecycle === "archived") {
      new Notice("项目状态笔记不可写");
      return;
    }
    new TextInputModal(this.app, projectDetailActionTitle(project.name, action), projectDetailActionPlaceholder(action), async text => {
      const existingContent = await this.app.vault.adapter.read(project.statusNote).catch(() => "");
      const preview = createProjectDetailActionPreview({ project, action, text, existingContent });
      this.confirmAndApplyWrite(preview);
    }).open();
  }

  /** 局部刷新 todo card，不触发全页重绘 */
  private async refreshTodoSection() {
    const todoCard = this.containerEl.querySelector<HTMLElement>(".ts-todo-card");
    if (!todoCard) { await this.render(); return; }

    const todos   = await loadTodos(this.app);
    const pending = todos.filter(t => !t.done);

    // 更新 pending 计数
    const meta = todoCard.querySelector<HTMLElement>(".ts-todo-meta");
    if (meta) meta.setText(pending.length > 0 ? `${pending.length} pending` : "");

    // 替换列表内容
    const existing = todoCard.querySelector<HTMLElement>(".ts-todo-list, .ts-empty");
    if (existing) existing.remove();
    this.renderTodos(todoCard, todos);
  }
  private runCmd(id: string) { try { (this.app as any).commands.executeCommandById(id); } catch {} }

  private registerLiveRefresh() {
    const onVaultChange = async (file: TAbstractFile) => {
      if (!this.shouldRefreshForPath(file.path)) return;
      this.scheduleLiveRender();
    };
    this.registerEvent(this.app.vault.on("modify", onVaultChange));
    this.registerEvent(this.app.vault.on("create", onVaultChange));
    this.registerEvent(this.app.vault.on("delete", onVaultChange));
  }

  private shouldRefreshForPath(path: string): boolean {
    if (path.startsWith(".thirdspace/")) return true;
    if (!path.endsWith(".md")) return false;
    if (path === getTodayWorklogPath()) return true;
    if (path.startsWith("02-日记/工作日志/")) return true;
    if (/^(0[0-6]|99)-/.test(path)) return true;
    return false;
  }

  private scheduleLiveRender() {
    if (this.liveRenderTimer) clearTimeout(this.liveRenderTimer);
    this.liveRenderTimer = window.setTimeout(async () => {
      this.liveRenderTimer = null;
      if (!this.containerEl.isConnected) return;
      await this.render();
    }, 300);
  }

  /** 蛇跑完後等 2 秒自動重播，不依賴 60s 全量刷新 */
  private scheduleSnakeReplay(container: HTMLElement, cells: SnakeCell[], durationMs: number) {
    if (this.snakeReplayTimer) clearTimeout(this.snakeReplayTimer);
    this.snakeReplayTimer = window.setTimeout(async () => {
      if (!container.isConnected) return; // 面板已被全量刷新，跳過
      const cache = await renderSnakeHeatmap(container, cells, this.snakeRouteCache ?? undefined);
      if (cache) {
        this.snakeRouteCache = cache;
        this.scheduleSnakeReplay(container, cells, cache.durationMs);
      }
    }, durationMs + 2000); // 動畫結束後 2s 重播
  }
}
