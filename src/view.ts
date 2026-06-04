import { ItemView, Modal, Notice, WorkspaceLeaf, TFile, TAbstractFile, setIcon } from "obsidian";
import type ThirdSpaceDashboard from "./main";
import {
  loadWorkspaceIndex, getWorkspaceStats, getDailyActivity,
  loadProductStatus, parseProducts, getRecentFiles,
  getProjectActivity, getGitActivity,
  localDateStr, localDateCompact, localTimestamp,
  loadTodos, loadTodayWorklog, getVaultStats, getTodayWorklogPath,
  ensureTodayWorklog, addTodoToWorklog, toggleTodoInWorklog, renameTodoInWorklog, archiveCompletedTodosInWorklog,
  archiveStaleTodosToProjectBacklog,
  loadProjectBacklog, promoteProjectBacklogItemToToday,
  type WorkspaceStats, type TodoItem, type VaultStats, type TodayWorklog,
  type DailyActivity, type ProjectActivity, type GitActivitySummary,
  type ProjectBacklogItem, type RecentFile, type TimelineItem, type TimelineKind,
} from "./data/vault-reader";
import {
  PROJECT_DISCOVERY_INBOX_PATH,
  acceptProjectCandidate,
  ignoreProjectCandidate,
  refreshProjectDiscovery,
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
import { buildSnakeCells, type SnakeCell } from "./data/worklog-parser";
import { renderSnakeHeatmap, type SnakeRouteCache } from "./components/snake-heatmap";

export const VIEW_TYPE = "thirdspace-dashboard";
type DashboardPage = "today" | "projects";
type TimelineFilter = "all" | TimelineKind;

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

// ── Dashboard View ────────────────────────────────────────────
export class DashboardView extends ItemView {
  plugin: ThirdSpaceDashboard;
  private timer: number | null = null;
  private liveRenderTimer: number | null = null;
  private archivingCompletedTodos = false;
  private archivingStaleTodos = false;
  private activePage: DashboardPage = "today";
  private timelineFilter: TimelineFilter = "all";
  private snakeRouteCache: SnakeRouteCache | null = null;
  private snakeReplayTimer: number | null = null;
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
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ts-dash");
    await this.archiveStaleTodosFromOldWorklogs();

    const [wsIndex, productMd, activity, projectActivity, gitActivity, todos, projectBacklog, todayWorklog, discovery, onboarding, materials] = await Promise.all([
      loadWorkspaceIndex(this.app),
      loadProductStatus(this.app),
      getDailyActivity(this.app, 365),
      getProjectActivity(this.app, 90),
      getGitActivity(this.app, 90),
      loadTodos(this.app),
      loadProjectBacklog(this.app),
      loadTodayWorklog(this.app),
      refreshProjectDiscovery(this.app),
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

    // ── macOS dashboard shell
    const hdr = contentEl.createDiv({ cls: "ts-hdr" });
    const hdrL = hdr.createDiv({ cls: "ts-hdr-left" });
    const titleBlock = hdrL.createDiv({ cls: "ts-title-block" });
    titleBlock.createDiv({ cls: "ts-app-title", text: "ThirdSpace" });
    titleBlock.createDiv({ cls: "ts-vault-title", text: (this.app.vault as any).getName?.() ?? "Vault" });
    const pill = hdrL.createDiv({ cls: `ts-pill ${wsIndex ? "ts-pill--ok" : "ts-pill--warn"}` });
    pill.setText(wsIndex ? `${wsStats.length} workspaces` : "no .thirdspace");
    if (discovery.pending.length > 0 || discovery.error) {
      const discoveryPill = hdrL.createDiv({
        cls: `ts-pill ${discovery.error ? "ts-pill--warn" : "ts-pill--notice"}`,
        text: discovery.error ? "project scan issue" : `${discovery.pending.length} project candidates`,
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
      this.renderTodayPage(board, vaultStats, activity, todos, projectBacklog, todayWorklog);
    } else {
      this.renderProjectsPage(board, activity, projectActivity, gitActivity, wsStats, recent, products, discovery, onboarding, materials);
    }
    this.renderPageSwitch(contentEl);

  }

  private renderTodayPage(
    board: HTMLElement,
    vaultStats: VaultStats,
    activity: DailyActivity[],
    todos: TodoItem[],
    projectBacklog: ProjectBacklogItem[],
    todayWorklog: TodayWorklog | null,
  ) {
    const pending = todos.filter(t => !t.done);

    const overviewCol = board.createDiv({ cls: "ts-board-col ts-overview-col" });
    const overviewCard = overviewCol.createDiv({ cls: "ts-card ts-compact-card ts-overview-card" });
    overviewCard.createDiv({ cls: "ts-card-label", text: "OVERVIEW" });
    this.renderStatsRow(overviewCard, vaultStats, activity.filter(a=>a.count>0).length);

    const quickCol = board.createDiv({ cls: "ts-board-col ts-quick-col" });
    const actCard = quickCol.createDiv({ cls: "ts-card ts-compact-card ts-quick-card" });
    actCard.createDiv({ cls: "ts-card-label", text: "QUICK" });
    this.renderActions(actCard);

    const todayCol = board.createDiv({ cls: "ts-board-col ts-today-col" });
    const logCard = todayCol.createDiv({ cls: "ts-card ts-compact-card ts-today-card" });
    const logHd   = logCard.createDiv({ cls: "ts-card-head" });
    logHd.createSpan({ cls: "ts-card-label", text: "TODAY" });
    logHd.createSpan({ cls: "ts-card-meta", text: new Date().toLocaleDateString("zh-CN",{month:"short",day:"numeric",weekday:"short"}) });
    this.renderTodayWorklog(logCard, todayWorklog ?? this.emptyTodayWorklog(), !todayWorklog);

    const todoCol = board.createDiv({ cls: "ts-board-col ts-todo-col" });
    const todoCard = todoCol.createDiv({ cls: "ts-card ts-compact-card ts-todo-card" });
    const tdHd = todoCard.createDiv({ cls: "ts-card-head" });
    tdHd.createSpan({ cls: "ts-card-label", text: "TODAY'S TODOS" });
    const tdMeta = tdHd.createSpan({ cls: "ts-card-meta ts-todo-meta" });
    if (pending.length > 0) tdMeta.setText(`${pending.length} pending`);
    this.renderTodos(todoCard, todos);

    const backlogCol = board.createDiv({ cls: "ts-board-col ts-backlog-col" });
    const backlogCard = backlogCol.createDiv({ cls: "ts-card ts-compact-card ts-backlog-card" });
    const bgHd = backlogCard.createDiv({ cls: "ts-card-head" });
    bgHd.createSpan({ cls: "ts-card-label", text: "PROJECT POOL" });
    bgHd.createSpan({ cls: "ts-card-meta", text: `${projectBacklog.length} items` });
    this.renderProjectBacklog(backlogCard, projectBacklog);
  }

  private renderProjectsPage(
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
  ) {
    const activityCol = board.createDiv({ cls: "ts-board-col ts-activity-col" });
    const heatSec  = activityCol.createDiv({ cls: "ts-card ts-compact-card ts-heatmap-card" });
    if (this.snakeReplayTimer) { clearTimeout(this.snakeReplayTimer); this.snakeReplayTimer = null; }
    this.renderActivityDashboard(heatSec, activity, projectActivity, gitActivity);

    const workspaceCol = board.createDiv({ cls: "ts-board-col ts-workspace-col" });
    const wsCard = workspaceCol.createDiv({ cls: "ts-card ts-compact-card ts-workspaces-card" });
    wsCard.createDiv({ cls: "ts-card-label", text: "WORKSPACES" });
    this.renderWorkspaces(wsCard, wsStats);

    const recentCol = board.createDiv({ cls: "ts-board-col ts-recent-col" });
    const recCard = recentCol.createDiv({ cls: "ts-card ts-compact-card ts-recent-card" });
    recCard.createDiv({ cls: "ts-card-label", text: "RECENT" });
    this.renderRecent(recCard, recent);

    const materialsCol = board.createDiv({ cls: "ts-board-col ts-materials-col" });
    const materialsCard = materialsCol.createDiv({ cls: "ts-card ts-compact-card ts-materials-card" });
    materialsCard.createDiv({ cls: "ts-card-label", text: "MATERIALS" });
    this.renderProjectMaterialsCard(materialsCard, materials);

    const productsCol = board.createDiv({ cls: "ts-board-col ts-products-col" });
    const prodCard = productsCol.createDiv({ cls: "ts-card ts-compact-card ts-products-card" });
    prodCard.createDiv({ cls: "ts-card-label", text: "PRODUCTS" });
    this.renderProducts(prodCard, products, discovery, onboarding);
  }

  private renderPageSwitch(parent: HTMLElement) {
    const switcher = parent.createDiv({ cls: "ts-page-switch" });
    const pages: Array<{ id: DashboardPage; label: string; icon: string }> = [
      { id: "today", label: "今日工作", icon: "calendar-check" },
      { id: "projects", label: "项目系统", icon: "folder-kanban" },
    ];
    for (const page of pages) {
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
    title.createSpan({ cls: "ts-card-label", text: "ACTIVITY" });
    title.createSpan({
      cls: "ts-card-meta",
      text: `90d · ${activeDays90} active · week ${weekCount}${streak > 0 ? ` · ${streak}d streak` : ""}`,
    });

    const headMeta = head.createDiv({ cls: "ts-activity-head-metrics" });
    this.renderActivityMetric(headMeta, "Today", todayCount, "files");
    this.renderActivityMetric(headMeta, "Top", topProject?.name ?? "—", topProject ? `${topProject.recentCount} files` : "no project");

    const body = parent.createDiv({ cls: "ts-activity-body" });
    const vaultPanel = body.createDiv({ cls: "ts-activity-panel ts-activity-panel--vault" });
    vaultPanel.createDiv({ cls: "ts-activity-panel-title", text: "全库 90 天" });
    this.renderNinetyDayCalendar(vaultPanel, recent90);

    const projectPanel = body.createDiv({ cls: "ts-activity-panel ts-activity-panel--projects" });
    projectPanel.createDiv({ cls: "ts-activity-panel-title", text: `项目活跃 · ${projects.length}` });
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
      list.createDiv({ cls: "ts-empty", text: "No project activity" });
      return;
    }
    visible.forEach((project, idx) => {
      const row = list.createDiv({
        cls: `ts-project-activity-row${project.lifecycle === "archived" ? " is-archived" : ""}`,
        attr: { style: `--ts-i:${idx}` },
      });
      const copy = row.createDiv({ cls: "ts-project-activity-copy" });
      copy.createDiv({ cls: "ts-project-activity-name", text: project.name });
      copy.createDiv({ cls: "ts-project-activity-meta", text: `${project.recentCount} files · ${project.lastModified ? this.relTime(project.lastModified) : "—"}` });
      const bar = row.createDiv({ cls: "ts-project-activity-bar" });
      bar.createDiv({ cls: "ts-project-activity-fill", attr: { style: `width:${Math.round(project.recentCount / max * 100)}%;--ts-i:${idx}` } });
    });
  }

  private renderGitActivity(parent: HTMLElement, git: GitActivitySummary) {
    const chart = parent.createDiv({ cls: "ts-git-trend" });
    const max = Math.max(...git.days.map(d => d.count), 1);
    git.days.forEach((day, idx) => {
      const bar = chart.createDiv({ cls: "ts-git-day" });
      const pct = day.count > 0 ? Math.max(8, Math.round(day.count / max * 100)) : 0;
      bar.createDiv({ cls: "ts-git-fill", attr: { style: `height:${pct}%;--ts-i:${idx}` } });
      bar.setAttr("title", `${day.date}: ${day.count} commits`);
    });

    const repos = parent.createDiv({ cls: "ts-git-repo-list" });
    const visible = git.repos.slice(0, 3);
    const repoMax = Math.max(...visible.map(r => r.count), 1);
    if (visible.length === 0) {
      repos.createDiv({ cls: "ts-empty", text: "No Git activity" });
      return;
    }
    visible.forEach((repo, idx) => {
      const row = repos.createDiv({ cls: "ts-git-repo-row", attr: { style: `--ts-i:${idx}` } });
      row.createSpan({ cls: "ts-git-repo-name", text: repo.name });
      row.createSpan({ cls: "ts-git-repo-count", text: `${repo.count}` });
      row.createDiv({ cls: "ts-git-repo-bar" }).createDiv({
        cls: "ts-git-repo-fill",
        attr: { style: `width:${Math.round(repo.count / repoMax * 100)}%;--ts-i:${idx}` },
      });
    });
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
      card.createDiv({ cls: "ts-ws-count", text: `${ws.fileCount} files` });
      card.createDiv({ cls: "ts-ws-bar" }).createDiv({ cls: "ts-ws-fill", attr: { style: `width:${Math.round(ws.fileCount/maxFiles*100)}%` } });
      card.createDiv({ cls: "ts-ws-time", text: ws.lastModified ? `active ${this.relTime(ws.lastModified)}` : "—" });
    }
  }

  // ── Project backlog (from per-project 未完成事项.md)
  private renderProjectBacklog(parent: HTMLElement, items: ProjectBacklogItem[]) {
    if (items.length === 0) {
      parent.createDiv({ cls: "ts-empty", text: "No project backlog" });
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
      today.disabled = true;
      today.setText("加入中");
      await promoteProjectBacklogItemToToday(this.app, item);
      new Notice(`${item.project} 已加入今日 Todo`);
      await this.refreshTodoSection();
      await this.render();
    });
    const open = actions.createEl("button", { cls: "ts-backlog-btn", text: "打开" });
    open.addEventListener("click", () => this.openFile(item.path));
  }

  // ── Todos (from today's worklog ## 今日Todo)
  private renderTodos(parent: HTMLElement, items: TodoItem[]) {
    const pending = items.filter(t => !t.done);
    const done    = items.filter(t => t.done);

    if (items.length === 0) {
      parent.createDiv({ cls: "ts-empty", text: 'No todos — click "记TODO" to add' });
      return;
    }
    const list = parent.createDiv({ cls: "ts-todo-list" });
    for (const item of [...pending, ...done]) this.renderTodoRow(list, item);
  }

  private renderTodoRow(parent: HTMLElement, item: TodoItem) {
    const row = parent.createDiv({ cls: `ts-todo-row${item.done ? " ts-todo-done" : ""}` });
    const chk = row.createEl("button", {
      cls: "ts-todo-chk",
      attr: { "aria-label": item.done ? "Mark todo incomplete" : "Mark todo complete" },
    });
    setIcon(chk, item.done ? "check-square" : "square");
    const txt = row.createSpan({ cls: "ts-todo-txt", text: item.text });

    // checkbox 单击 = 切换完成状态（原地更新，无全页刷新）
    chk.addEventListener("click", async e => {
      e.stopPropagation();
      // 乐观更新：先改 DOM，再写文件
      item.done = !item.done;
      chk.setAttr("aria-label", item.done ? "Mark todo incomplete" : "Mark todo complete");
      setIcon(chk, item.done ? "check-square" : "square");
      if (item.done) row.addClass("ts-todo-done");
      else           row.removeClass("ts-todo-done");
      // 同步更新 header 上的 pending 计数
      const todoCard = row.closest<HTMLElement>(".ts-todo-card");
      if (todoCard) {
        const meta = todoCard.querySelector<HTMLElement>(".ts-todo-meta");
        if (meta) {
          const pendingCount = todoCard.querySelectorAll<HTMLElement>(".ts-todo-row:not(.ts-todo-done)").length;
          meta.setText(pendingCount > 0 ? `${pendingCount} pending` : "");
        }
      }
      await toggleTodoInWorklog(this.app, item);
      if (item.done) {
        this.showTodoArchiveToast(item.text);
        await this.refreshTodoSection();
      }
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
      txt.replaceWith(input);
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
          await renameTodoInWorklog(this.app, item, newText);
          item.text = newText;
        }
        // 原地把 input 换回 span，无全页刷新
        const span = createEl("span", { cls: "ts-todo-txt", text: item.text });
        input.replaceWith(span);
      };

      input.addEventListener("keydown", async ev => {
        if (ev.key === "Enter")  { ev.preventDefault(); await save(); }
        if (ev.key === "Escape") {
          saved = true;
          // 取消：原地恢复原始 span
          const span = createEl("span", { cls: "ts-todo-txt", text: item.text });
          input.replaceWith(span);
        }
      });
      input.addEventListener("blur", save);
    });
  }

  // ── Today: ## 今日重点 + ## 今日Todo + ## 重点记录 + event stream ──
  private emptyTodayWorklog(): TodayWorklog {
    return { highlights: [], todos: [], entries: [], outputs: [], events: [], timeline: [] };
  }

  private renderTodayWorklog(parent: HTMLElement, today: TodayWorklog, missingLog = false) {
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
      focusBody.createDiv({ cls: "ts-empty ts-today-empty", text: "No highlights" });
    } else {
      const hl = focusBody.createDiv({ cls: "ts-log-highlights" });
      for (const h of today.highlights) {
        const row = hl.createDiv({ cls: "ts-log-highlight-row" });
        row.addEventListener("click", openToday);
        row.createSpan({ cls: "ts-log-hl-bullet", text: "◆" });
        row.createSpan({ cls: "ts-log-hl-text",   text: h });
      }
    }

    const todoCard = body.createDiv({ cls: "ts-today-subcard ts-today-subcard--todo" });
    todoCard.createDiv({ cls: "ts-today-subhead", text: "今日Todo" });
    const todoBody = todoCard.createDiv({ cls: "ts-today-scroll" });
    if (today.todos.length === 0) {
      todoBody.createDiv({ cls: "ts-empty ts-today-empty", text: missingLog ? "今日日志创建后显示 Todo" : "No todos" });
    } else {
      const todoWrap = todoBody.createDiv({ cls: "ts-log-section" });
      const pendingTodos = today.todos.filter(t => !t.done);
      const doneTodos = today.todos.filter(t => t.done);
      for (const item of [...pendingTodos, ...doneTodos]) {
        const row = todoWrap.createDiv({ cls: `ts-log-todo-row${item.done ? " ts-log-todo-done" : ""}` });
        row.addEventListener("click", openToday);
        row.createSpan({ cls: "ts-log-todo-box", text: item.done ? "☑" : "☐" });
        row.createSpan({ cls: "ts-log-todo-text", text: item.text });
      }
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
      flowBody.createDiv({ cls: "ts-empty ts-today-empty", text: "No items for this filter" });
    } else {
      flowBody.createDiv({ cls: "ts-empty ts-today-empty", text: missingLog ? "今日日志创建后显示记录/产出" : "No records" });
    }
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
    const row = parent.createDiv({ cls: `ts-timeline-row ts-timeline-row--${item.kind}` });
    row.addEventListener("click", () => this.openTimelineItem(item));

    const meta = row.createDiv({ cls: "ts-timeline-meta" });
    meta.createSpan({ cls: "ts-timeline-badge", text: item.badge });
    meta.createSpan({ cls: "ts-timeline-time", text: item.time || "----" });

    const copy = row.createDiv({ cls: "ts-timeline-copy" });
    copy.createDiv({ cls: "ts-timeline-title", text: item.title });
    if (item.subtitle) copy.createDiv({ cls: "ts-timeline-subtitle", text: item.subtitle });
    if (item.body.length > 0) {
      const body = copy.createDiv({ cls: "ts-timeline-detail" });
      for (const line of item.body.slice(0, 2)) body.createDiv({ cls: "ts-timeline-line", text: line });
    }
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
      parent.createDiv({ cls: "ts-empty", text: "No product status" });
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
      if (products.length > visible.length) list.createDiv({ cls: "ts-inline-more", text: `+ ${products.length - visible.length} more products` });
    }

    this.renderProjectDiscovery(parent, discovery, onboardingPending);
  }

  private renderProjectDiscovery(parent: HTMLElement, discovery: ProjectDiscoverySummary, onboarding: ProjectOnboardingItem[]) {
    if (discovery.error) {
      const warn = parent.createDiv({ cls: "ts-discovery-box ts-discovery-box--warn" });
      warn.createDiv({ cls: "ts-discovery-kicker", text: "SYSTEM / INBOX" });
      warn.createDiv({ cls: "ts-discovery-title", text: "项目发现扫描异常" });
      warn.createDiv({ cls: "ts-discovery-path", text: discovery.error });
      return;
    }
    if (discovery.pending.length > 0) {
      const box = parent.createDiv({ cls: "ts-discovery-box" });
      const head = box.createDiv({ cls: "ts-discovery-head" });
      const copy = head.createDiv({ cls: "ts-discovery-copy" });
      copy.createDiv({ cls: "ts-discovery-kicker", text: "SYSTEM / INBOX" });
      copy.createDiv({ cls: "ts-discovery-title", text: `${discovery.pending.length} 个新项目待确认` });
      const openBtn = head.createEl("button", { cls: "ts-discovery-open", text: "打开确认单" });
      openBtn.addEventListener("click", () => this.openFile(discovery.notePath));

      const list = box.createDiv({ cls: "ts-discovery-list" });
      for (const candidate of discovery.pending.slice(0, 3)) this.renderCandidateRow(list, candidate);
      if (discovery.pending.length > 3) {
        const more = list.createDiv({ cls: "ts-inline-more", text: `+ ${discovery.pending.length - 3} more candidates` });
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
      const accepted = await acceptProjectCandidate(this.app, candidate.id);
      new Notice(accepted ? `已纳入 ${candidate.name}` : `未找到待确认项目：${candidate.name}`);
      await this.render();
    });

    const ignore = actions.createEl("button", { cls: "ts-discovery-btn", text: "忽略" });
    ignore.addEventListener("click", async () => {
      const ignored = await ignoreProjectCandidate(this.app, candidate.id);
      new Notice(ignored ? `已忽略 ${candidate.name}` : `未找到待确认项目：${candidate.name}`);
      await this.render();
    });
  }

  private renderProjectOnboarding(parent: HTMLElement, onboarding: ProjectOnboardingItem[]) {
    const box = parent.createDiv({ cls: "ts-discovery-box ts-discovery-box--onboarding" });
    const head = box.createDiv({ cls: "ts-discovery-head" });
    const copy = head.createDiv({ cls: "ts-discovery-copy" });
    copy.createDiv({ cls: "ts-discovery-kicker", text: "PROJECT ONBOARDING" });
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
        connect.disabled = true;
        connect.setText("接入中");
        const result = await runProjectOnboarding(this.app, item.id);
        if (result) {
          new Notice(`${item.name} 接入完成：hook=${result.hookStatus}，history=${result.historyStatus}`);
        } else {
          new Notice(`未找到待接入项目：${item.name}`);
        }
        await this.render();
      });
    }
    if (onboarding.length > 4) list.createDiv({ cls: "ts-inline-more", text: `+ ${onboarding.length - 4} more onboarding items` });
  }

  private renderProjectMaterialsCard(parent: HTMLElement, materials: ProjectMaterialsItem[]) {
    if (materials.length === 0) {
      parent.createDiv({ cls: "ts-empty", text: "No project materials" });
      return;
    }

    const pending = materials.filter(item => item.needsImport);
    const synced = materials.length - pending.length;
    const summary = parent.createDiv({ cls: "ts-material-summary" });
    summary.createDiv({ cls: `ts-material-pill ${pending.length > 0 ? "ts-material-pill--warn" : "ts-material-pill--ok"}`, text: `${synced}真实/${materials.length}总数 synced` });
    summary.createDiv({ cls: "ts-material-pill", text: pending.length > 0 ? `${pending.length} pending` : "all current" });

    const list = parent.createDiv({ cls: "ts-material-list" });
    const visible = materials.slice(0, this.singleScreenLimit.materials);
    for (const item of visible) this.renderProjectMaterialRow(list, item);
    if (materials.length > visible.length) {
      list.createDiv({ cls: "ts-inline-more", text: `+ ${materials.length - visible.length} more material projects` });
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
      text: item.needsImport ? (item.importedCount > 0 ? "更新" : "导入") : "重扫",
    });
    importBtn.addEventListener("click", async () => {
      importBtn.disabled = true;
      importBtn.setText(item.needsImport ? "处理中" : "重扫中");
      const result = await runProjectMaterialsImport(this.app, item.id);
      if (result) {
        new Notice(`${item.name} 资料索引完成：${result.importedCount} files`);
      } else {
        new Notice(`未找到资料导入项目：${item.name}`);
      }
      await this.render();
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
    if (d===0) return "today"; if (d===1) return "1d";
    if (d<7) return `${d}d`; if (d<30) return `${Math.floor(d/7)}w`;
    return `${Math.floor(d/30)}mo`;
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
    try { const f = await this.app.vault.create(path, fm); await this.app.workspace.getLeaf(false).openFile(f); }
    catch { const f = this.app.vault.getAbstractFileByPath(path) as TFile|null; if (f) await this.app.workspace.getLeaf(false).openFile(f); }
  }
  private async openTodayLog() {
    const f = await ensureTodayWorklog(this.app);
    await this.app.workspace.getLeaf(false).openFile(f);
  }
  private openTodoModal() {
    new TodoModal(this.app, async (text) => {
      await addTodoToWorklog(this.app, text);
      await this.refreshTodoSection();
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

  private async archiveStaleTodosFromOldWorklogs() {
    if (this.archivingStaleTodos) return;
    this.archivingStaleTodos = true;
    try {
      await archiveStaleTodosToProjectBacklog(this.app);
    } finally {
      this.archivingStaleTodos = false;
    }
  }

  private registerLiveRefresh() {
    const onVaultChange = async (file: TAbstractFile) => {
      if (!this.shouldRefreshForPath(file.path)) return;
      if (file.path === getTodayWorklogPath()) await this.archiveCompletedTodosFromToday();
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

  private async archiveCompletedTodosFromToday() {
    if (this.archivingCompletedTodos) return;
    this.archivingCompletedTodos = true;
    try {
      await archiveCompletedTodosInWorklog(this.app);
    } finally {
      this.archivingCompletedTodos = false;
    }
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
