import type { App, TFile } from "obsidian";

// ── Local date helpers（讀系統時區，不硬編碼）────────────────────
// sv-SE locale 的格式恰好是 YYYY-MM-DD / HH:MM:SS，且跟隨系統時區
const _dateFmt = new Intl.DateTimeFormat("sv-SE");
const _tsFmt   = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

export function localDateStr(d: Date): string     { return _dateFmt.format(d); }             // "2026-05-27"
export function localDateCompact(d: Date): string { return _dateFmt.format(d).replace(/-/g,""); } // "20260527"
export function localTimestamp(d: Date): string   { return _tsFmt.format(d).replace(",",""); }    // "2026-05-27 14:30:00"

// ── Frontmatter date helpers ──────────────────────────────────
function parseFmDate(s: unknown): number {
  if (!s || typeof s !== "string") return 0;
  try { return new Date(s.replace(" ", "T")).getTime() || 0; } catch { return 0; }
}
function fileCreated(app: App, f: TFile): number {
  const fm = app.metadataCache.getFileCache(f)?.frontmatter;
  return parseFmDate(fm?.created) || f.stat.ctime || f.stat.mtime;
}
function fileModified(app: App, f: TFile): number {
  const fm = app.metadataCache.getFileCache(f)?.frontmatter;
  return parseFmDate(fm?.modified) || f.stat.mtime;
}

// ── Interfaces ───────────────────────────────────────────────
export interface WorkspaceEntry  { dir: string; skill: string; desc: string; }
export interface WorkspaceStats  { dir: string; icon: string; desc: string; fileCount: number; lastModified: number; }
export interface DailyActivity   { date: string; count: number; }
export interface ProjectIndexEntry {
  id: string;
  name: string;
  workspace: string;
  lifecycle?: string;
  repo_path?: string;
  category?: string;
  project_home?: string;
  status_note?: string;
  codex_context?: string;
}
export interface ProjectActivity { id: string; name: string; workspace: string; lifecycle: string; recentCount: number; lastModified: number; }
export interface GitRepoActivity { id: string; name: string; branch: string; count: number; lastCommit: number; }
export interface GitActivitySummary { days: DailyActivity[]; repos: GitRepoActivity[]; total: number; }
export interface TodoItem        { text: string; done: boolean; }
export interface VaultStats      { total: number; thisWeek: number; thisMonth: number; activeDays: number; }
export interface WorklogEntry    { time: string; title: string; body: string[]; }
export interface WorklogEvent    { kind: "agent" | "git"; time: string; title: string; }
export interface WorklogOutput   { title: string; raw: string; }
export interface TodayWorklog    { highlights: string[]; todos: TodoItem[]; entries: WorklogEntry[]; outputs: WorklogOutput[]; events: WorklogEvent[]; }
export interface ProjectBacklogItem { text: string; project: string; path: string; source: string; }

const PROJECT_UNFINISHED_NAME = "未完成事项.md";
const PROJECT_COMPLETED_NAME = "完成事项.md";
const FALLBACK_UNFINISHED_PATH = "01-收件箱/待整理/项目未完成事项.md";
const FALLBACK_COMPLETED_PATH = "01-收件箱/待整理/项目完成事项.md";
const TASK_ARCHIVE_START_COMPACT = "20260603";

// ── Skip rules ───────────────────────────────────────────────
// Use exact path-segment matching, not substring — prevents false positives
// on notes whose names happen to contain "INDEX", "README", etc.
const SKIP_DIRS  = new Set(["_legacy", ".thirdspace"]);
const SKIP_NAMES = new Set(["WORKSPACE", "AGENTS", "CLAUDE", "README", "INDEX"]);

function shouldSkip(f: TFile): boolean {
  const parts = f.path.split("/");
  if (parts.some(p => SKIP_DIRS.has(p))) return true;
  if (SKIP_NAMES.has(f.basename))         return true;
  return false;
}

// ── Constants ────────────────────────────────────────────────
const WORKSPACE_ICONS: Record<string, string> = {
  "00-系统": "⚙", "01-收件箱": "↓", "02-日记": "◈",
  "03-知识": "◎", "04-项目": "▲", "05-资源": "⬡",
  "06-输出": "→", "99-归档": "⊞",
};
const DEFAULT_WORKSPACES = [
  "00-系统","01-收件箱","02-日记","03-知识",
  "04-项目","05-资源","06-输出","99-归档",
];
const WEEKDAYS = ["日","一","二","三","四","五","六"];

// ── Worklog path helper ──────────────────────────────────────
export function getTodayWorklogPath(): string {
  const now = new Date();
  const ymd = localDateCompact(now);
  return `02-日记/工作日志/${ymd}_工作日志_周${WEEKDAYS[now.getDay()]}.md`;
}

export async function ensureTodayWorklog(app: App): Promise<TFile> {
  const path = getTodayWorklogPath();
  const existing = app.vault.getAbstractFileByPath(path) as TFile | null;
  if (existing) return existing;

  const now = new Date();
  const ts = localTimestamp(now);
  const ds = localDateStr(now);
  const wd = WEEKDAYS[now.getDay()];
  const tpl = [
    "---",
    `title: "${localDateCompact(now)} 工作日志 周${wd}"`,
    `type: "worklog"`,
    `topic: "work"`,
    `workspace: "02-日记"`,
    `created: "${ts}"`,
    `modified: "${ts}"`,
    `tags: ["worklog", "thirdspace"]`,
    `source: "agent"`,
    `status: "active"`,
    "---",
    "",
    `# ${localDateCompact(now)} 工作日志 周${wd}`,
    "",
    "## 今日重点",
    "",
    "## 今日Todo",
    "",
    "## 重点记录",
    "",
    "## 今日产出",
    "",
    "## Git Hook 采集",
    "",
    "## Git 历史索引",
    "",
    "## 决策",
    "",
    "## 下一步",
    "",
    "## Agent 产出",
    "",
    "## Git 提交",
    "",
  ].join("\n");

  return await app.vault.create(path, tpl.replace("${ds}", ds));
}

// ── Workspace index ──────────────────────────────────────────
export async function loadWorkspaceIndex(app: App): Promise<WorkspaceEntry[] | null> {
  try {
    const content = await app.vault.adapter.read(".thirdspace/workspace-index.yaml");
    return parseWorkspaceYaml(content);
  } catch { return null; }
}

export async function loadProjectIndex(app: App): Promise<ProjectIndexEntry[]> {
  try {
    const content = await app.vault.adapter.read(".thirdspace/project-index.yaml");
    return parseProjectIndexYaml(content);
  } catch {
    return [];
  }
}

function parseProjectIndexYaml(content: string): ProjectIndexEntry[] {
  const entries: ProjectIndexEntry[] = [];
  let cur: Partial<ProjectIndexEntry> | null = null;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- id:")) {
      if (cur?.id && cur.name && cur.workspace) entries.push(cur as ProjectIndexEntry);
      cur = { id: yamlValue(line.replace("- id:", "")), name: "", workspace: "", lifecycle: "active" };
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("name:"))      cur.name = yamlValue(line.replace("name:", ""));
    if (line.startsWith("workspace:")) cur.workspace = yamlValue(line.replace("workspace:", ""));
    if (line.startsWith("lifecycle:")) cur.lifecycle = yamlValue(line.replace("lifecycle:", ""));
    if (line.startsWith("repo_path:")) cur.repo_path = yamlValue(line.replace("repo_path:", ""));
    if (line.startsWith("category:"))  cur.category = yamlValue(line.replace("category:", ""));
    if (line.startsWith("project_home:"))  cur.project_home = yamlValue(line.replace("project_home:", ""));
    if (line.startsWith("status_note:"))   cur.status_note = yamlValue(line.replace("status_note:", ""));
    if (line.startsWith("codex_context:")) cur.codex_context = yamlValue(line.replace("codex_context:", ""));
  }
  if (cur?.id && cur.name && cur.workspace) entries.push(cur as ProjectIndexEntry);
  return entries;
}

function yamlValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function parseWorkspaceYaml(content: string): WorkspaceEntry[] {
  const entries: WorkspaceEntry[] = [];
  let cur: Partial<WorkspaceEntry> | null = null;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- dir:")) {
      if (cur?.dir) entries.push(cur as WorkspaceEntry);
      cur = { dir: line.replace("- dir:","").trim().replace(/['"]/g,""), skill:"", desc:"" };
    } else if (cur) {
      if (line.startsWith("skill:")) cur.skill = line.replace("skill:","").trim().replace(/['"]/g,"");
      if (line.startsWith("desc:"))  cur.desc  = line.replace("desc:","").trim().replace(/['"]/g,"");
    }
  }
  if (cur?.dir) entries.push(cur as WorkspaceEntry);
  return entries;
}

// ── Workspace stats ──────────────────────────────────────────
export async function getWorkspaceStats(app: App, dirs: string[]): Promise<WorkspaceStats[]> {
  const allFiles = app.vault.getMarkdownFiles();
  const targetDirs = dirs.length > 0 ? dirs : DEFAULT_WORKSPACES;
  return targetDirs.map(dir => {
    const files = allFiles.filter(f =>
      f.path.startsWith(dir+"/") &&
      !SKIP_DIRS.has(f.path.split("/")[1] ?? "")  // 只排除 _legacy/.thirdspace 子目录
    );
    const lastMod = files.reduce((m,f) => Math.max(m, fileModified(app, f)), 0);
    return { dir, icon: WORKSPACE_ICONS[dir] ?? "◇", desc: dir.replace(/^\d+-/,""), fileCount: files.length, lastModified: lastMod };
  });
}

// ── Activity ─────────────────────────────────────────────────
export async function getDailyActivity(app: App, days = 365): Promise<DailyActivity[]> {
  const cutoff = Date.now() - days * 86_400_000;
  const countMap: Record<string, number> = {};
  for (const f of app.vault.getMarkdownFiles()) {
    if (shouldSkip(f)) continue;
    const ts = fileCreated(app, f);
    if (ts < cutoff) continue;
    const date = localDateStr(new Date(ts));
    countMap[date] = (countMap[date] ?? 0) + 1;
  }
  return Object.entries(countMap).map(([date,count])=>({date,count})).sort((a,b)=>a.date.localeCompare(b.date));
}

export async function getProjectActivity(app: App, days = 90): Promise<ProjectActivity[]> {
  const projects = await loadProjectIndex(app);
  const cutoff = Date.now() - days * 86_400_000;
  return projects.map(project => {
    const files = app.vault.getMarkdownFiles().filter(f =>
      f.path.startsWith(project.workspace + "/") &&
      !shouldSkip(f)
    );
    const recentCount = files.filter(f => fileModified(app, f) > cutoff).length;
    const lastModified = files.reduce((max, f) => Math.max(max, fileModified(app, f)), 0);
    return {
      id: project.id,
      name: project.name,
      workspace: project.workspace,
      lifecycle: project.lifecycle ?? "active",
      recentCount,
      lastModified,
    };
  }).sort((a, b) => b.recentCount - a.recentCount || b.lastModified - a.lastModified);
}

export async function getGitActivity(app: App, days = 90): Promise<GitActivitySummary> {
  const start = startOfLocalDay(new Date());
  start.setDate(start.getDate() - (days - 1));
  const endMs = Date.now();
  const countMap: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    countMap[localDateStr(d)] = 0;
  }

  const repos: GitRepoActivity[] = [];
  let total = 0;
  try {
    const raw = await app.vault.adapter.read(".thirdspace/git/commits.json");
    const data = JSON.parse(raw) as { repos?: Array<{ id?: string; name?: string; branch?: string; commits?: Array<{ time?: string }> }> };
    for (const repo of data.repos ?? []) {
      let repoCount = 0;
      let lastCommit = 0;
      for (const commit of repo.commits ?? []) {
        const ts = commit.time ? new Date(commit.time).getTime() : 0;
        if (!ts) continue;
        lastCommit = Math.max(lastCommit, ts);
        if (ts < start.getTime() || ts > endMs) continue;
        const date = localDateStr(new Date(ts));
        countMap[date] = (countMap[date] ?? 0) + 1;
        repoCount++;
        total++;
      }
      repos.push({
        id: repo.id ?? repo.name ?? "repo",
        name: repo.name ?? repo.id ?? "repo",
        branch: repo.branch ?? "",
        count: repoCount,
        lastCommit,
      });
    }
  } catch {}

  return {
    days: Object.entries(countMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    repos: repos.sort((a, b) => b.count - a.count || b.lastCommit - a.lastCommit),
    total,
  };
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getVaultStats(app: App): VaultStats {
  const files = app.vault.getMarkdownFiles().filter(f => !shouldSkip(f));
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000, monthAgo = now - 30 * 86_400_000;
  const daySet = new Set<string>();
  let week = 0, month = 0;
  for (const f of files) {
    const ts = fileCreated(app, f);
    if (ts > weekAgo)  week++;
    if (ts > monthAgo) month++;
    if (ts > now - 365 * 86_400_000) daySet.add(localDateStr(new Date(ts)));
  }
  return { total: files.length, thisWeek: week, thisMonth: month, activeDays: daySet.size };
}

export function getRecentFiles(app: App, days = 7) {
  const cutoff = Date.now() - days * 86_400_000;
  return app.vault.getMarkdownFiles()
    .filter(f => fileModified(app, f) > cutoff && !shouldSkip(f))
    .sort((a,b) => fileModified(app, b) - fileModified(app, a))
    .map(f => ({ path: f.path, name: f.basename, workspace: f.path.split("/")[0]??"", mtime: fileModified(app, f) }));
}

// ── Products ─────────────────────────────────────────────────
export async function loadProductStatus(app: App): Promise<string | null> {
  try {
    const f = app.vault.getAbstractFileByPath("04-项目/product-status.md") as TFile|null;
    if (f) return await app.vault.read(f);
  } catch {}
  return null;
}

export function parseProducts(md: string): Array<{name:string; status:string; milestone:string}> {
  const results: Array<{name:string;status:string;milestone:string}> = [];
  let currentStatus = "unknown";
  for (const line of md.split("\n")) {
    if (line.startsWith("## ")) {
      if (line.includes("🟢")) currentStatus = "active";
      else if (line.includes("🟡")) currentStatus = "watch";
      else if (line.includes("🔴") || line.includes("搁置") || line.includes("放弃")) currentStatus = "paused";
    }
    if (line.startsWith("### ")) results.push({ name: line.replace("### ","").trim(), status: currentStatus, milestone:"" });
    if (line.includes("当前里程碑") && results.length > 0) {
      const last = results[results.length-1];
      if (!last.milestone) last.milestone = line.replace(/.*：\s*/,"").trim();
    }
  }
  return results.filter(p => p.status !== "unknown");
}

// ── Todos (from today's worklog ## 今日Todo) ─────────────────
export async function loadTodos(app: App): Promise<TodoItem[]> {
  try {
    const f = app.vault.getAbstractFileByPath(getTodayWorklogPath()) as TFile | null;
    if (!f) return [];
    const md = await app.vault.read(f);
    return parseTodosFromMd(md);
  } catch { return []; }
}

export function parseTodosFromMd(md: string): TodoItem[] {
  const items: TodoItem[] = [];
  let inTodoSection = false;
  for (const line of md.split("\n")) {
    if (line.startsWith("## 今日Todo")) { inTodoSection = true; continue; }
    if (line.startsWith("## ") && !line.startsWith("## 今日Todo")) { inTodoSection = false; }
    if (!inTodoSection) continue;
    const m = line.match(/^- \[( |x)\] (.+)/);
    if (m) {
      const text = m[2].replace(/✅ \d{4}-\d{2}-\d{2}/g,"").trim();
      if (text) items.push({ text, done: m[1]==="x" });
    }
  }
  return items;
}

export async function addTodoToWorklog(app: App, text: string): Promise<void> {
  const f = await ensureTodayWorklog(app);
  const md = await app.vault.read(f);
  const lines = md.split("\n");
  const secIdx = lines.findIndex(l => l.trim() === "## 今日Todo");
  const newItem = `- [ ] ${text}`;
  if (secIdx >= 0) {
    const bounds = sectionBounds(lines, "今日Todo");
    const normalized = cleanTaskText(text);
    const exists = lines.slice(bounds.start, bounds.end).some(line => cleanTaskText(line) === normalized);
    if (exists) return;
    // insert right after the section header (skip blank lines)
    let insertAt = secIdx + 1;
    while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt++;
    lines.splice(insertAt, 0, newItem);
  } else {
    lines.push("", "## 今日Todo", "", newItem, "");
  }
  await app.vault.modify(f, lines.join("\n"));
}

export async function toggleTodoInWorklog(app: App, item: TodoItem): Promise<void> {
  const path = getTodayWorklogPath();
  const f = app.vault.getAbstractFileByPath(path) as TFile | null;
  if (!f) return;
  const md = await app.vault.read(f);
  const today = localDateStr(new Date());
  const lines = md.split("\n");
  const bounds = sectionBounds(lines, "今日Todo");
  for (let i = bounds.start; i < bounds.end; i++) {
    const m = lines[i].match(/^- \[( |x)\] (.+)/);
    if (!m) continue;
    const cleaned = m[2].replace(/✅ \d{4}-\d{2}-\d{2}/g,"").trim();
    if (cleaned !== item.text) continue;
    if (item.done) {
      const output = `- ${cleaned} ✅ ${today}`;
      lines.splice(i, 1);
      appendOutputLine(lines, output);
      await archiveCompletedProjectTask(app, cleaned, f.path);
    } else {
      lines[i] = lines[i].replace(/^- \[x\]/, "- [ ]").replace(/ ✅ \d{4}-\d{2}-\d{2}/g,"");
    }
    await app.vault.modify(f, lines.join("\n"));
    return;
  }
}

export async function archiveCompletedTodosInWorklog(app: App): Promise<boolean> {
  const path = getTodayWorklogPath();
  const f = app.vault.getAbstractFileByPath(path) as TFile | null;
  if (!f) return false;

  const md = await app.vault.read(f);
  const archived = archiveCompletedTodosInMarkdown(md);
  if (!archived.changed) return false;

  for (const output of archived.archived) {
    await archiveCompletedProjectTask(app, cleanTaskText(output), f.path);
  }
  await app.vault.modify(f, archived.markdown);
  return true;
}

export function archiveCompletedTodosInMarkdown(md: string): { markdown: string; changed: boolean; archived: string[] } {
  const today = localDateStr(new Date());
  const lines = md.split("\n");
  const bounds = sectionBounds(lines, "今日Todo");
  const archived: string[] = [];

  for (let i = bounds.end - 1; i >= bounds.start; i--) {
    const m = lines[i].match(/^- \[x\] (.+)/);
    if (!m) continue;
    const cleaned = m[1].replace(/✅ \d{4}-\d{2}-\d{2}/g,"").trim();
    if (!cleaned) continue;
    const output = `- ${cleaned} ✅ ${today}`;
    lines.splice(i, 1);
    archived.unshift(output);
  }

  for (const output of archived) appendOutputLine(lines, output);
  return { markdown: lines.join("\n"), changed: archived.length > 0, archived };
}

function sectionBounds(lines: string[], section: string): { start: number; end: number } {
  const heading = `## ${section}`;
  const sectionIdx = lines.findIndex(line => line.trim() === heading);
  if (sectionIdx === -1) return { start: lines.length, end: lines.length };
  const nextSection = lines.findIndex((line, idx) => idx > sectionIdx && line.startsWith("## "));
  return { start: sectionIdx + 1, end: nextSection === -1 ? lines.length : nextSection };
}

function appendOutputLine(lines: string[], output: string): void {
  if (lines.some(line => line.trim() === output)) return;

  let sectionIdx = lines.findIndex(line => line.trim() === "## 今日产出");
  if (sectionIdx === -1) {
    lines.push("", "## 今日产出", "", output);
    return;
  }

  let insertAt = sectionIdx + 1;
  while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt++;
  const nextSection = lines.findIndex((line, idx) => idx > sectionIdx && line.startsWith("## "));
  if (nextSection >= 0 && insertAt > nextSection) insertAt = nextSection;
  lines.splice(insertAt, 0, output);
}

export async function archiveStaleTodosToProjectBacklog(app: App): Promise<boolean> {
  const todayPath = getTodayWorklogPath();
  const todayCompact = localDateCompact(new Date());
  const worklogs = app.vault.getMarkdownFiles()
    .filter(f => {
      if (!f.path.startsWith("02-日记/工作日志/") || f.path === todayPath) return false;
      const compact = worklogDateFromPath(f.path);
      return Boolean(compact && compact >= TASK_ARCHIVE_START_COMPACT && compact < todayCompact);
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  let changed = false;

  for (const file of worklogs) {
    const md = await app.vault.read(file);
    const lines = md.split("\n");
    const bounds = sectionBounds(lines, "今日Todo");
    const unfinished: string[] = [];

    for (let i = bounds.end - 1; i >= bounds.start; i--) {
      const m = lines[i].match(/^- \[ \] (.+)/);
      if (!m) continue;
      const text = cleanTaskText(m[1]);
      if (!text) continue;
      unfinished.unshift(text);
      lines.splice(i, 1);
    }

    if (unfinished.length === 0) continue;
    for (const text of unfinished) await appendUnfinishedProjectTask(app, text, file.path);
    appendNextStepLine(lines, "- 未完成 Todo 已归档到对应项目的 `未完成事项.md`；无项目归属的进入收件箱待整理。");
    await app.vault.modify(file, lines.join("\n"));
    changed = true;
  }

  return changed;
}

export async function loadProjectBacklog(app: App): Promise<ProjectBacklogItem[]> {
  await syncProjectBacklogFromProjectNotes(app);
  const todayTasks = new Set((await loadTodos(app)).map(todo => cleanTaskText(todo.text)));
  const completedCache = new Map<string, Set<string>>();
  const files = app.vault.getMarkdownFiles()
    .filter(f => f.basename === "未完成事项" || f.path === FALLBACK_UNFINISHED_PATH)
    .sort((a, b) => a.path.localeCompare(b.path));
  const items: ProjectBacklogItem[] = [];

  for (const file of files) {
    const md = await app.vault.read(file);
    const project = projectNameFromTaskLedger(app, file);
    const completedPath = file.path.replace(/[^/]+$/, PROJECT_COMPLETED_NAME);
    if (!completedCache.has(completedPath)) {
      completedCache.set(completedPath, await loadTaskLedgerTexts(app, completedPath));
    }
    const completedTasks = completedCache.get(completedPath) ?? new Set<string>();
    for (const line of md.split("\n")) {
      const m = line.match(/^- \[ \] (.+)/);
      if (!m) continue;
      const text = cleanTaskText(m[1]);
      if (!text) continue;
      const todayText = todayTodoTextFromProject(project, text);
      if (todayTasks.has(cleanTaskText(todayText)) || completedTasks.has(text) || completedTasks.has(todayText)) continue;
      items.push({ text, project, path: file.path, source: file.path });
    }
  }

  return items;
}

async function syncProjectBacklogFromProjectNotes(app: App): Promise<void> {
  const projects = (await loadProjectIndex(app))
    .filter(project => project.workspace && project.lifecycle !== "archived");
  const todayTasks = new Set((await loadTodos(app)).map(todo => cleanTaskText(todo.text)));

  for (const project of projects) {
    const sourcePaths = uniqueStrings([
      project.project_home,
      project.status_note,
      project.codex_context,
    ]);
    if (sourcePaths.length === 0) continue;

    const completedTasks = await loadTaskLedgerTexts(app, `${project.workspace}/${PROJECT_COMPLETED_NAME}`);
    for (const sourcePath of sourcePaths) {
      const file = app.vault.getAbstractFileByPath(sourcePath) as TFile | null;
      if (!file) continue;
      const md = await app.vault.read(file);
      const tasks = extractProjectBacklogTasks(md);
      for (const text of tasks) {
        const todayText = todayTodoTextFromProject(project.name, text);
        if (todayTasks.has(cleanTaskText(todayText)) || completedTasks.has(text) || completedTasks.has(todayText)) continue;
        const line = `- [ ] ${text}（来源：[[${sourcePath.replace(/\.md$/i, "")}|${file.basename}]]）`;
        await appendTaskLedgerLine(
          app,
          `${project.workspace}/${PROJECT_UNFINISHED_NAME}`,
          "未完成事项",
          line,
          text,
          "unfinished",
        );
      }
    }
  }
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function extractProjectBacklogTasks(md: string): string[] {
  const tasks: string[] = [];
  const seen = new Set<string>();
  let inTaskSection = false;
  const targetSections = new Set(["下一步", "今日Todo", "未完成事项", "待办事项", "待办"]);

  for (const line of md.split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      inTaskSection = targetSections.has(heading[1].trim());
      continue;
    }
    if (!inTaskSection) continue;
    if (line.startsWith("# ")) {
      inTaskSection = false;
      continue;
    }

    const task = line.match(/^\s*[-*]\s+\[ \]\s+(.+)/);
    const bullet = line.match(/^\s*[-*]\s+(?!\[[xX]\]\s)(.+)/);
    const raw = task?.[1] ?? bullet?.[1];
    if (!raw) continue;

    const text = cleanTaskText(raw);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    tasks.push(text);
  }

  return tasks;
}

async function loadTaskLedgerTexts(app: App, path: string): Promise<Set<string>> {
  const file = app.vault.getAbstractFileByPath(path) as TFile | null;
  if (!file) return new Set();
  const md = await app.vault.read(file);
  const tasks = new Set<string>();
  for (const line of md.split("\n")) {
    const task = line.match(/^\s*[-*]\s+\[[ xX]\]\s+(.+)/);
    if (!task) continue;
    const text = cleanTaskText(task[1]);
    if (text) tasks.add(text);
  }
  return tasks;
}

export async function promoteProjectBacklogItemToToday(app: App, item: ProjectBacklogItem): Promise<void> {
  await addTodoToWorklog(app, todayTodoTextFromProjectBacklog(item));
  await removeTaskLedgerLine(app, item.path, item.text);
}

function todayTodoTextFromProjectBacklog(item: ProjectBacklogItem): string {
  return todayTodoTextFromProject(item.project, item.text);
}

function todayTodoTextFromProject(projectName: string, taskText: string): string {
  const project = projectName.trim();
  const text = taskText.trim();
  if (!project || project === "待整理") return text;
  const normalized = text.toLowerCase();
  const prefix = project.toLowerCase();
  if (normalized.startsWith(`${prefix}:`) || normalized.startsWith(`${prefix}：`)) return text;
  return `${project}：${text}`;
}

function worklogDateFromPath(path: string): string | null {
  const name = path.split("/").pop() ?? "";
  const compact = name.match(/^(\d{8})_工作日志_/)?.[1];
  return compact ?? null;
}

function projectNameFromTaskLedger(app: App, file: TFile): string {
  const fmProject = app.metadataCache.getFileCache(file)?.frontmatter?.project;
  if (typeof fmProject === "string" && fmProject.trim()) return fmProject.trim();
  const parts = file.path.split("/");
  return parts.slice(-2, -1)[0] ?? "待整理";
}

async function appendUnfinishedProjectTask(app: App, text: string, sourcePath: string): Promise<void> {
  const path = await resolveProjectTaskPath(app, text, "unfinished");
  const sourceTitle = sourcePath.replace(/\.md$/i, "");
  const line = `- [ ] ${text}（来源：[[${sourceTitle}|工作日志]]）`;
  await appendTaskLedgerLine(app, path, "未完成事项", line, text, "unfinished");
}

async function archiveCompletedProjectTask(app: App, text: string, sourcePath: string): Promise<void> {
  const completedPath = await resolveProjectTaskPath(app, text, "completed");
  const unfinishedPath = await resolveProjectTaskPath(app, text, "unfinished");
  await removeTaskLedgerLine(app, unfinishedPath, text);
  const today = localDateStr(new Date());
  const sourceTitle = sourcePath.replace(/\.md$/i, "");
  const line = `- [x] ${text} ✅ ${today}（来源：[[${sourceTitle}|工作日志]]）`;
  await appendTaskLedgerLine(app, completedPath, "完成事项", line, text, "completed");
}

async function resolveProjectTaskPath(app: App, text: string, kind: "unfinished" | "completed"): Promise<string> {
  const project = (await loadProjectIndex(app)).find(p => taskBelongsToProject(text, p));
  if (!project?.workspace) return kind === "unfinished" ? FALLBACK_UNFINISHED_PATH : FALLBACK_COMPLETED_PATH;
  return `${project.workspace}/${kind === "unfinished" ? PROJECT_UNFINISHED_NAME : PROJECT_COMPLETED_NAME}`;
}

function taskBelongsToProject(text: string, project: ProjectIndexEntry): boolean {
  const normalized = text.trim().toLowerCase();
  const names = [project.name, project.id].filter(Boolean);
  return names.some(name => {
    const n = String(name).trim().toLowerCase();
    return normalized.startsWith(`${n}：`) || normalized.startsWith(`${n}:`) || normalized === n;
  });
}

async function appendTaskLedgerLine(
  app: App,
  path: string,
  section: "未完成事项" | "完成事项",
  line: string,
  taskText: string,
  kind: "unfinished" | "completed",
): Promise<void> {
  const md = await readOrCreateTaskLedger(app, path, kind);
  const lines = md.split("\n");
  if (lines.some(existing => cleanTaskText(existing) === taskText)) return;
  let bounds = sectionBounds(lines, section);
  if (bounds.start === lines.length && bounds.end === lines.length) {
    lines.push("", `## ${section}`, "");
    bounds = sectionBounds(lines, section);
  }
  let insertAt = bounds.start;
  while (insertAt < bounds.end && lines[insertAt].trim() === "") insertAt++;
  lines.splice(insertAt, 0, line);
  await writeTaskLedger(app, path, lines.join("\n"));
}

async function removeTaskLedgerLine(app: App, path: string, taskText: string): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path) as TFile | null;
  if (!file) return;
  const md = await app.vault.read(file);
  const lines = md.split("\n");
  const next = lines.filter(line => cleanTaskText(line) !== taskText);
  if (next.length === lines.length) return;
  await app.vault.modify(file, next.join("\n"));
}

async function readOrCreateTaskLedger(app: App, path: string, kind: "unfinished" | "completed"): Promise<string> {
  const file = app.vault.getAbstractFileByPath(path) as TFile | null;
  if (file) return app.vault.read(file);

  const now = localTimestamp(new Date());
  const projectName = path.split("/").slice(-2, -1)[0] ?? "项目";
  const section = kind === "unfinished" ? "未完成事项" : "完成事项";
  const workspace = path.startsWith("01-收件箱/") ? "01-收件箱" : "04-项目";
  const content = [
    "---",
    `title: "${projectName} ${section}"`,
    'type: "project_task_ledger"',
    'topic: "project-tasks"',
    `workspace: "${workspace}"`,
    `created: "${now}"`,
    `modified: "${now}"`,
    'tags: ["project", "tasks"]',
    'source: "dashboard"',
    'status: "active"',
    `project: "${projectName}"`,
    "---",
    "",
    `# ${projectName} ${section}`,
    "",
    `## ${section}`,
    "",
  ].join("\n");
  await ensureFolder(app, path.split("/").slice(0, -1).join("/"));
  await app.vault.create(path, content);
  return content;
}

async function writeTaskLedger(app: App, path: string, md: string): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path) as TFile | null;
  const now = localTimestamp(new Date());
  const next = md.replace(/modified: ".*?"/, `modified: "${now}"`);
  if (!file) {
    await app.vault.adapter.write(path, next);
    return;
  }
  await app.vault.modify(file, next);
}

function appendNextStepLine(lines: string[], line: string): void {
  if (lines.some(existing => existing.trim() === line)) return;
  let sectionIdx = lines.findIndex(existing => existing.trim() === "## 下一步");
  if (sectionIdx === -1) {
    lines.push("", "## 下一步", "", line);
    return;
  }
  let insertAt = sectionIdx + 1;
  while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt++;
  const nextSection = lines.findIndex((existing, idx) => idx > sectionIdx && existing.startsWith("## "));
  if (nextSection >= 0 && insertAt > nextSection) insertAt = nextSection;
  lines.splice(insertAt, 0, line);
}

function cleanTaskText(text: string): string {
  return text
    .replace(/^[-*]\s*/, "")
    .replace(/^\[[ xX]\]\s*/, "")
    .replace(/✅ \d{4}-\d{2}-\d{2}/g, "")
    .replace(/（来源：\[\[[^\]]+\]\]）/g, "")
    .trim();
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  if (!folderPath) return;
  const parts = folderPath.split("/").filter(Boolean);
  let cur = "";
  for (const part of parts) {
    cur = cur ? `${cur}/${part}` : part;
    if (await app.vault.adapter.exists(cur)) continue;
    await app.vault.createFolder(cur);
  }
}

export async function renameTodoInWorklog(app: App, item: TodoItem, newText: string): Promise<void> {
  const path = getTodayWorklogPath();
  const f = app.vault.getAbstractFileByPath(path) as TFile | null;
  if (!f) return;
  const md = await app.vault.read(f);
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(- \[[ x]\] )(.+)/);
    if (!m) continue;
    const cleaned = m[2].replace(/✅ \d{4}-\d{2}-\d{2}/g,"").trim();
    if (cleaned !== item.text) continue;
    // 保留完成状态和 ✅ 日期
    const doneDate = m[2].match(/ ✅ \d{4}-\d{2}-\d{2}/)?.[0] ?? "";
    lines[i] = `${m[1]}${newText}${doneDate}`;
    await app.vault.modify(f, lines.join("\n"));
    return;
  }
}

// ── Today's worklog entries (## 今日重点 / 今日Todo / 重点记录 / event stream) ──
export async function loadTodayWorklog(app: App): Promise<TodayWorklog | null> {
  try {
    const today = localDateStr(new Date()).replace(/-/g,"");
    const logFile = app.vault.getMarkdownFiles().find(f =>
      f.path.startsWith("02-日记/工作日志/") && f.basename.startsWith(today)
    );
    if (!logFile) return null;
    const md = await app.vault.read(logFile);
    const highlights = parseHighlights(md);
    const todos      = parseTodosFromMd(md);
    const entries    = parseWorklogEntries(md);
    const outputs    = parseWorklogOutputs(md);
    const events     = parseWorklogEvents(md);
    return { highlights, todos, entries, outputs, events };
  } catch { return null; }
}

/** 读取 ## 今日重点 下的非空行（去掉 Markdown 格式符） */
export function parseHighlights(md: string): string[] {
  const lines: string[] = [];
  let inSection = false;
  for (const line of md.split("\n")) {
    if (line.startsWith("## 今日重点")) { inSection = true; continue; }
    if (line.startsWith("## ") && !line.startsWith("## 今日重点")) { inSection = false; continue; }
    if (!inSection) continue;
    const t = line.replace(/^[-*]\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1").trim();
    if (t) lines.push(t);
  }
  return lines;
}

/** 读取 ## 重点记录 下的 ### HH:MM — 标题 条目，并保留该条记录正文 */
export function parseWorklogEntries(md: string): WorklogEntry[] {
  const entries: WorklogEntry[] = [];
  let inSection = false;
  let current: WorklogEntry | null = null;
  for (const line of md.split("\n")) {
    if (line.startsWith("## 重点记录")) {
      inSection = true;
      current = null;
      continue;
    }
    if (line.startsWith("## ") && !line.startsWith("## 重点记录")) {
      inSection = false;
      current = null;
      continue;
    }
    if (!inSection) continue;
    const h3 = line.match(/^###\s+(\d{1,2}:\d{2})\s*[—\-–]\s*(.+)/);
    if (h3) {
      current = { time: h3[1], title: h3[2].trim(), body: [] };
      entries.push(current);
      continue;
    }
    const text = line.trim();
    if (current && text) current.body.push(text);
  }
  return entries;
}

/** 读取 ## 今日产出 下的链接/路径列表，展示为紧凑产物流 */
export function parseWorklogOutputs(md: string): WorklogOutput[] {
  const outputs: WorklogOutput[] = [];
  let inSection = false;
  for (const line of md.split("\n")) {
    if (line.startsWith("## 今日产出")) { inSection = true; continue; }
    if (line.startsWith("## ") && !line.startsWith("## 今日产出")) { inSection = false; continue; }
    if (!inSection) continue;
    const raw = line.replace(/^[-*]\s+/, "").trim();
    if (!raw) continue;
    outputs.push({ raw, title: displayTitleFromOutput(raw) });
  }
  return outputs.reverse();
}

function displayTitleFromOutput(raw: string): string {
  const wiki = raw.match(/^\[\[(?:[^|\]]+\|)?([^\]]+)\]\]$/);
  if (wiki) return wiki[1].trim();

  const md = raw.match(/^\[([^\]]+)\]\([^)]+\)$/);
  if (md) return md[1].trim();

  const code = raw.match(/^`(.+)`$/);
  const value = (code?.[1] ?? raw).trim();
  const file = value.split("/").filter(Boolean).pop() ?? value;
  return file.replace(/\.md$/i, "").trim();
}

/** 读取 ## Agent 产出 / ## Git 提交 下的事件行，作为 Today 实时流 */
export function parseWorklogEvents(md: string): WorklogEvent[] {
  const events: WorklogEvent[] = [];
  let current: WorklogEvent["kind"] | null = null;
  for (const line of md.split("\n")) {
    if (line.startsWith("## Agent 产出")) { current = "agent"; continue; }
    if (line.startsWith("## Git 提交"))   { current = "git"; continue; }
    if (line.startsWith("## "))           { current = null; continue; }
    if (!current) continue;

    const text = line.replace(/^[-*]\s+/, "").trim();
    if (!text) continue;

    const m = text.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})(?::\d{2})?\s+(.+)/);
    const time = m?.[2] ?? "";
    const rest = (m?.[3] ?? text).trim();
    const title = rest || text;
    events.push({ kind: current, time, title });
  }
  return events.reverse();
}
