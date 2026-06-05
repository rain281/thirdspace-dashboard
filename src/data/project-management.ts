export const STANDARD_PROJECT_STATUS_SECTIONS = [
  "项目摘要",
  "目标",
  "成功标准",
  "当前阶段",
  "当前里程碑",
  "本周 Focus",
  "下一步",
  "风险与阻塞",
  "待决策",
  "决策记录",
  "交付门禁",
  "最近状态",
  "复盘记录",
  "关联资源",
  "历史备注",
] as const;

export type ProjectPriority = "P0" | "P1" | "P2" | "P3";
export type ProjectStage = "孵化" | "聚焦" | "构建" | "交付" | "增长" | "维护" | "暂停";
export type ManagedLifecycle = "active" | "watch" | "paused" | "archived";
export type FocusRole = "main" | "support" | "maintenance";
export type ProjectHealthStatus = "健康" | "注意" | "风险";
export type ProjectStatusSection = typeof STANDARD_PROJECT_STATUS_SECTIONS[number];

export interface ParsedProjectStatus {
  path: string;
  projectId: string;
  priority: ProjectPriority;
  stage: ProjectStage;
  lifecycle: ManagedLifecycle;
  updated: string;
  title: string;
  sections: Record<ProjectStatusSection, string> & {
    goal: string;
    nextStep: string;
  };
  missingSections: ProjectStatusSection[];
}

const PRIORITIES = new Set<ProjectPriority>(["P0", "P1", "P2", "P3"]);
const STAGES = new Set<ProjectStage>(["孵化", "聚焦", "构建", "交付", "增长", "维护", "暂停"]);
const LIFECYCLES = new Set<ManagedLifecycle>(["active", "watch", "paused", "archived"]);

export function parseProjectStatusMarkdown(markdown: string, path: string): ParsedProjectStatus {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const sections = emptySections();
  const title = firstHeading(body) || basenameWithoutMd(path);
  const parsedSections = parseSections(body);

  for (const section of STANDARD_PROJECT_STATUS_SECTIONS) {
    sections[section] = parsedSections.get(section)?.trim() ?? "";
  }

  sections.goal = sections["目标"];
  sections.nextStep = sections["下一步"];

  return {
    path,
    projectId: scalar(frontmatter.project),
    priority: normalizePriority(frontmatter.priority),
    stage: normalizeStage(frontmatter.stage),
    lifecycle: normalizeLifecycle(frontmatter.lifecycle),
    updated: scalar(frontmatter.updated),
    title,
    sections,
    missingSections: STANDARD_PROJECT_STATUS_SECTIONS.filter(section => sections[section].trim().length === 0),
  };
}

function splitFrontmatter(markdown: string): { frontmatter: Record<string, string>; body: string } {
  const lines = markdown.split("\n");
  if (lines[0]?.trim() !== "---") return { frontmatter: {}, body: markdown };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return { frontmatter: {}, body: markdown };
  const frontmatter: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    frontmatter[match[1]] = stripQuotes(match[2].trim());
  }
  return { frontmatter, body: lines.slice(end + 1).join("\n") };
}

function parseSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current = "";
  let buffer: string[] = [];
  const flush = () => {
    if (current) sections.set(current, buffer.join("\n").trim());
  };

  for (const line of markdown.split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flush();
      current = heading[1].trim();
      buffer = [];
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();
  return sections;
}

function emptySections(): ParsedProjectStatus["sections"] {
  return Object.fromEntries(STANDARD_PROJECT_STATUS_SECTIONS.map(section => [section, ""])) as ParsedProjectStatus["sections"];
}

function firstHeading(markdown: string): string {
  return markdown.split("\n").find(line => line.startsWith("# "))?.replace(/^#\s+/, "").trim() ?? "";
}

function basenameWithoutMd(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

function normalizePriority(value: string | undefined): ProjectPriority {
  return PRIORITIES.has(value as ProjectPriority) ? value as ProjectPriority : "P2";
}

function normalizeStage(value: string | undefined): ProjectStage {
  return STAGES.has(value as ProjectStage) ? value as ProjectStage : "孵化";
}

function normalizeLifecycle(value: string | undefined): ManagedLifecycle {
  return LIFECYCLES.has(value as ManagedLifecycle) ? value as ManagedLifecycle : "watch";
}

function scalar(value: string | undefined): string {
  return value?.trim() ?? "";
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

export interface FocusProject {
  id: string;
  role: FocusRole;
  reason: string;
}

export interface OffFocusEvent {
  date: string;
  projectId: string;
  reason: string;
  target: string;
}

export interface FocusWeek {
  week: string;
  focusLimit: number;
  focusProjects: FocusProject[];
  offFocusPolicy: string;
  offFocusEvents: OffFocusEvent[];
}

export function parseFocusWeekYaml(content: string, now = new Date()): FocusWeek {
  if (!content.trim()) return emptyFocusWeek(now);
  const lines = content.split("\n");
  const focusProjects: FocusProject[] = [];
  const offFocusEvents: OffFocusEvent[] = [];
  let week = "";
  let focusLimit = 3;
  let offFocusPolicy = "allow_today_with_reason";
  let list: "focus" | "off-focus" | "" = "";
  let currentFocus: Partial<FocusProject> | null = null;
  let currentOffFocus: Partial<OffFocusEvent> | null = null;

  const flushFocus = () => {
    if (currentFocus?.id && currentFocus.role) {
      focusProjects.push({
        id: currentFocus.id,
        role: currentFocus.role,
        reason: currentFocus.reason ?? "",
      });
    }
    currentFocus = null;
  };
  const flushOffFocus = () => {
    if (currentOffFocus?.date && currentOffFocus.projectId) {
      offFocusEvents.push({
        date: currentOffFocus.date,
        projectId: currentOffFocus.projectId,
        reason: currentOffFocus.reason ?? "",
        target: currentOffFocus.target ?? "",
      });
    }
    currentOffFocus = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("week:")) week = yamlScalar(line.replace("week:", ""));
    else if (line.startsWith("focus_limit:")) focusLimit = Number(yamlScalar(line.replace("focus_limit:", ""))) || 3;
    else if (line.startsWith("off_focus_policy:")) offFocusPolicy = yamlScalar(line.replace("off_focus_policy:", ""));
    else if (line === "focus_projects:") { flushOffFocus(); list = "focus"; }
    else if (line === "off_focus_events:") { flushFocus(); list = "off-focus"; }
    else if (line.startsWith("- id:") && list === "focus") {
      flushFocus();
      currentFocus = { id: yamlScalar(line.replace("- id:", "")) };
    } else if (line.startsWith("- date:") && list === "off-focus") {
      flushOffFocus();
      currentOffFocus = { date: yamlScalar(line.replace("- date:", "")) };
    } else if (list === "focus" && currentFocus) {
      if (line.startsWith("role:")) currentFocus.role = normalizeFocusRole(yamlScalar(line.replace("role:", "")));
      if (line.startsWith("reason:")) currentFocus.reason = yamlScalar(line.replace("reason:", ""));
    } else if (list === "off-focus" && currentOffFocus) {
      if (line.startsWith("project_id:")) currentOffFocus.projectId = yamlScalar(line.replace("project_id:", ""));
      if (line.startsWith("reason:")) currentOffFocus.reason = yamlScalar(line.replace("reason:", ""));
      if (line.startsWith("target:")) currentOffFocus.target = yamlScalar(line.replace("target:", ""));
    }
  }
  flushFocus();
  flushOffFocus();

  return {
    week: week || currentIsoWeek(now),
    focusLimit,
    focusProjects,
    offFocusPolicy,
    offFocusEvents,
  };
}

export function currentIsoWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function emptyFocusWeek(now: Date): FocusWeek {
  return {
    week: currentIsoWeek(now),
    focusLimit: 3,
    focusProjects: [],
    offFocusPolicy: "allow_today_with_reason",
    offFocusEvents: [],
  };
}

function normalizeFocusRole(value: string): FocusRole {
  if (value === "main" || value === "support" || value === "maintenance") return value;
  return "support";
}

function yamlScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

export interface ProjectIndexLike {
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

export interface ProjectHealth {
  status: ProjectHealthStatus;
  reasons: string[];
}

export interface ManagedProject {
  id: string;
  name: string;
  category: string;
  lifecycle: ManagedLifecycle;
  priority: ProjectPriority;
  stage: ProjectStage;
  workspace: string;
  repoPath: string;
  projectHome: string;
  statusNote: string;
  codexContext: string;
  goal: string;
  successCriteria: string;
  milestone: string;
  nextStep: string;
  risks: string;
  pendingDecisions: string;
  deliveryGates: string;
  recentStatus: string;
  updated: string;
  focusRole: FocusRole | null;
  focusReason: string;
  health: ProjectHealth;
}

export interface PortfolioSummary {
  totalManaged: number;
  activeCount: number;
  watchCount: number;
  focusLimit: number;
  focusUsed: number;
  riskCount: number;
  attentionCount: number;
  staleCount: number;
  noNextStepCount: number;
  deliveryGateGapCount: number;
}

export interface DeriveManagedProjectsInput {
  projects: ProjectIndexLike[];
  statuses: Map<string, ParsedProjectStatus>;
  focusWeek: FocusWeek;
  now: Date;
}

export function deriveManagedProjects(input: DeriveManagedProjectsInput): ManagedProject[] {
  const focusById = new Map(input.focusWeek.focusProjects.map(item => [item.id, item]));
  return input.projects
    .flatMap(project => {
      const status = input.statuses.get(project.id);
      const lifecycle = status?.lifecycle ?? normalizeLifecycle(project.lifecycle);
      if (lifecycle === "archived") return [];
      const focus = focusById.get(project.id);
      const managed: ManagedProject = {
        id: project.id,
        name: project.name,
        category: project.category ?? "未分类",
        lifecycle,
        priority: status?.priority ?? "P2",
        stage: status?.stage ?? "孵化",
        workspace: project.workspace,
        repoPath: project.repo_path ?? "",
        projectHome: project.project_home ?? "",
        statusNote: project.status_note ?? status?.path ?? "",
        codexContext: project.codex_context ?? "",
        goal: status?.sections["目标"] ?? "",
        successCriteria: status?.sections["成功标准"] ?? "",
        milestone: status?.sections["当前里程碑"] ?? "",
        nextStep: status?.sections["下一步"] ?? "",
        risks: status?.sections["风险与阻塞"] ?? "",
        pendingDecisions: status?.sections["待决策"] ?? "",
        deliveryGates: status?.sections["交付门禁"] ?? "",
        recentStatus: status?.sections["最近状态"] ?? "",
        updated: status?.updated ?? "",
        focusRole: focus?.role ?? null,
        focusReason: focus?.reason ?? "",
        health: { status: "健康", reasons: [] },
      };
      managed.health = deriveProjectHealth(managed, input.now);
      return managed;
    })
    .sort(compareManagedProjects);
}

export function derivePortfolioSummary(projects: ManagedProject[], focusWeek: FocusWeek): PortfolioSummary {
  return {
    totalManaged: projects.length,
    activeCount: projects.filter(project => project.lifecycle === "active").length,
    watchCount: projects.filter(project => project.lifecycle === "watch").length,
    focusLimit: focusWeek.focusLimit,
    focusUsed: projects.filter(project => project.focusRole).length,
    riskCount: projects.filter(project => project.health.status === "风险").length,
    attentionCount: projects.filter(project => project.health.status === "注意").length,
    staleCount: projects.filter(project => project.health.reasons.includes("状态超过 7 天未更新")).length,
    noNextStepCount: projects.filter(project => project.health.reasons.includes("缺下一步")).length,
    deliveryGateGapCount: projects.filter(project => project.health.reasons.includes("交付阶段缺交付门禁")).length,
  };
}

function deriveProjectHealth(project: ManagedProject, now: Date): ProjectHealth {
  const reasons: string[] = [];
  const updatedAge = daysSince(project.updated, now);
  if (!project.goal.trim()) reasons.push("缺目标");
  if (!project.successCriteria.trim()) reasons.push("缺成功标准");
  if (!project.nextStep.trim()) reasons.push("缺下一步");
  if (updatedAge !== null && updatedAge > 7) reasons.push("状态超过 7 天未更新");
  if (project.stage === "交付" && !project.deliveryGates.trim()) reasons.push("交付阶段缺交付门禁");
  if (hasOpenRisk(project.risks)) reasons.push("存在未处理风险");
  if (project.pendingDecisions.trim()) reasons.push("存在待决策");

  const riskReasons = new Set(["缺下一步", "状态超过 7 天未更新", "存在未处理风险", "交付阶段缺交付门禁"]);
  const isRisk = project.priority === "P0" && reasons.some(reason => riskReasons.has(reason))
    || hasBlockingText(project.risks)
    || hasBlockingText(project.pendingDecisions)
    || (project.stage === "交付" && reasons.includes("交付阶段缺交付门禁"));

  return {
    status: isRisk ? "风险" : reasons.length > 0 ? "注意" : "健康",
    reasons,
  };
}

function compareManagedProjects(a: ManagedProject, b: ManagedProject): number {
  const focusOrder = focusRank(a.focusRole) - focusRank(b.focusRole);
  if (focusOrder !== 0) return focusOrder;
  const priorityOrder = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityOrder !== 0) return priorityOrder;
  return a.name.localeCompare(b.name);
}

function focusRank(role: FocusRole | null): number {
  if (role === "main") return 0;
  if (role === "support") return 1;
  if (role === "maintenance") return 2;
  return 3;
}

function priorityRank(priority: ProjectPriority): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority];
}

function daysSince(date: string, now: Date): number | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((now.getTime() - parsed.getTime()) / 86400000);
}

function hasOpenRisk(text: string): boolean {
  return text.split("\n").some(line => /^\s*[-*]\s+\[ \]\s+/.test(line));
}

function hasBlockingText(text: string): boolean {
  return text
    .split("\n")
    .some(line => /阻塞|blocked|卡住|等待/.test(line) && !/已解决|已解除|✅/.test(line));
}

export const FOCUS_WEEK_PATH = ".thirdspace/focus-week.yaml";

export interface PortfolioModel {
  focusWeek: FocusWeek;
  projects: ManagedProject[];
  summary: PortfolioSummary;
}
