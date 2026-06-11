import { createFocusYamlPreview, createManagedSectionPreview, type ControlledWritePreview } from "./controlled-write";
import type { ProjectBacklogItem, TimelineItem, TodayWorklog } from "./vault-reader";

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
  hasLifecycle: boolean;
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
    hasLifecycle: typeof frontmatter.lifecycle === "string" && frontmatter.lifecycle.trim().length > 0,
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
  confirmationStatus: "pending" | "confirmed";
  focusLimit: number;
  focusProjects: FocusProject[];
  offFocusPolicy: string;
  offFocusEvents: OffFocusEvent[];
}

export interface FocusConfirmationProject {
  id: string;
  name: string;
  priority: ProjectPriority;
  lifecycle: ManagedLifecycle;
  health: ProjectHealth;
}

export interface FocusConfirmationPreviewInput {
  week: string;
  projects: FocusConfirmationProject[];
  existingFocusYaml: string;
  existingWeeklyPlan: string;
}

export interface FocusConfirmationPreviews {
  focusProjects: FocusProject[];
  yaml: ControlledWritePreview;
  weeklyPlan: ControlledWritePreview;
}

export type ProjectDetailAction = "next-step" | "risk" | "decision";

export interface ProjectDetailActionPreviewInput {
  project: Pick<ManagedProject, "id" | "name" | "lifecycle" | "statusNote">;
  action: ProjectDetailAction;
  text: string;
  existingContent: string;
}

export function parseFocusWeekYaml(content: string, now = new Date()): FocusWeek {
  if (!content.trim()) return emptyFocusWeek(now);
  const lines = content.split("\n");
  const focusProjects: FocusProject[] = [];
  const offFocusEvents: OffFocusEvent[] = [];
  let week = "";
  let confirmationStatus: FocusWeek["confirmationStatus"] = "pending";
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
    else if (line.startsWith("confirmation_status:")) confirmationStatus = normalizeConfirmationStatus(yamlScalar(line.replace("confirmation_status:", "")));
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
    confirmationStatus,
    focusLimit,
    focusProjects: confirmationStatus === "confirmed" ? focusProjects : [],
    offFocusPolicy,
    offFocusEvents,
  };
}

export function createFocusConfirmationPreviews(input: FocusConfirmationPreviewInput): FocusConfirmationPreviews {
  const candidates = input.projects
    .filter(project => project.lifecycle !== "archived" && project.lifecycle !== "paused")
    .sort(compareFocusConfirmationProjects)
    .slice(0, 3);
  const roles: FocusRole[] = ["main", "support", "maintenance"];
  const focusProjects = candidates.map((project, index) => ({
    id: project.id,
    role: roles[index],
    reason: focusReason(project),
  }));

  const yaml = createFocusYamlPreview({
    path: FOCUS_WEEK_PATH,
    title: "确认下周 Focus",
    existingContent: input.existingFocusYaml,
    yaml: formatFocusWeekYaml(input.week, focusProjects),
    warnings: [
      "Focus 上限为 3；本次不会写入 archived 或 paused 项目。",
      "确认后会先写入 focus-week YAML，再通过下一次预览写入周计划镜像。",
    ],
  });

  const weeklyPlan = createManagedSectionPreview({
    path: focusWeeklyPlanPath(input.week),
    title: "写入周计划 Focus 镜像",
    section: "本周 Focus",
    marker: "weekly-focus",
    existingContent: input.existingWeeklyPlan || focusWeeklyPlanSkeleton(input.week),
    content: formatFocusWeeklyPlanMirror(input.week, candidates, focusProjects),
    warnings: [
      "只会替换 ## 本周 Focus 中的 Dashboard managed block，不覆盖手写计划。",
      "这是 focus-week YAML 的人类可读镜像。",
    ],
  });

  return { focusProjects, yaml, weeklyPlan };
}

export function createProjectDetailActionPreview(input: ProjectDetailActionPreviewInput): ControlledWritePreview {
  if (input.project.lifecycle === "archived") throw new Error("archived projects are read-only");
  if (!input.project.statusNote) throw new Error("project status note is missing");
  const config = projectDetailActionConfig(input.action, input.project.name);
  return createManagedSectionPreview({
    path: input.project.statusNote,
    title: config.title,
    section: config.section,
    marker: config.marker,
    existingContent: input.existingContent,
    content: `- [ ] ${input.text.trim()}`,
    warnings: [
      `只会写入项目状态笔记的 ## ${config.section} section。`,
      "不会修改归档项目，也不会写入代码仓库文件。",
    ],
  });
}

export function focusWeeklyPlanPath(week: string): string {
  return `02-日记/周计划/${week}_周计划.md`;
}

export function nextIsoWeek(date = new Date()): string {
  const next = new Date(date.getTime() + 7 * 86400000);
  return currentIsoWeek(next);
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
    confirmationStatus: "pending",
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

function normalizeConfirmationStatus(value: string): FocusWeek["confirmationStatus"] {
  return value === "confirmed" ? "confirmed" : "pending";
}

function yamlScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function compareFocusConfirmationProjects(a: FocusConfirmationProject, b: FocusConfirmationProject): number {
  return priorityRank(a.priority) - priorityRank(b.priority)
    || healthRank(a.health.status) - healthRank(b.health.status)
    || a.name.localeCompare(b.name);
}

function healthRank(status: ProjectHealthStatus): number {
  if (status === "风险") return 0;
  if (status === "注意") return 1;
  return 2;
}

function focusReason(project: FocusConfirmationProject): string {
  const health = project.health.reasons.slice(0, 2).join("、") || project.health.status;
  return `${project.priority} · ${health}`;
}

function formatFocusWeekYaml(week: string, focusProjects: FocusProject[]): string {
  return [
    `week: "${week}"`,
    `confirmation_status: "confirmed"`,
    "focus_limit: 3",
    "focus_projects:",
    ...focusProjects.flatMap(project => [
      `  - id: "${escapeYaml(project.id)}"`,
      `    role: "${project.role}"`,
      `    reason: "${escapeYaml(project.reason)}"`,
    ]),
    `off_focus_policy: "allow_today_with_reason"`,
    "off_focus_events: []",
  ].join("\n");
}

function formatFocusWeeklyPlanMirror(
  week: string,
  projects: FocusConfirmationProject[],
  focusProjects: FocusProject[],
): string {
  const byId = new Map(projects.map(project => [project.id, project]));
  return [
    `### Dashboard Focus 镜像 · ${week}`,
    "",
    ...focusProjects.map(project => {
      const source = byId.get(project.id);
      return `- ${source?.name ?? project.id}：${focusRoleLabelZh(project.role)} · ${project.reason}`;
    }),
  ].join("\n");
}

function focusWeeklyPlanSkeleton(week: string): string {
  return [`# ${week} 周计划`, "", "## 本周 Focus", ""].join("\n");
}

function projectDetailActionConfig(action: ProjectDetailAction, projectName: string): {
  title: string;
  section: ProjectStatusSection;
  marker: string;
} {
  if (action === "next-step") {
    return {
      title: `更新 ${projectName} 下一步`,
      section: "下一步",
      marker: "project-next-step",
    };
  }
  if (action === "risk") {
    return {
      title: `新增 ${projectName} 风险`,
      section: "风险与阻塞",
      marker: "project-risk",
    };
  }
  return {
    title: `新增 ${projectName} 待决策`,
    section: "待决策",
    marker: "project-decision",
  };
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function focusRoleLabelZh(role: FocusRole): string {
  if (role === "main") return "主项目";
  if (role === "support") return "副项目";
  return "维护项目";
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
      const lifecycle = status?.hasLifecycle ? status.lifecycle : normalizeLifecycle(project.lifecycle);
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

export interface TodayFocusProject {
  id: string;
  name: string;
  role: FocusRole;
  covered: boolean;
}

export interface TodayFocusCoverage {
  confirmationStatus: FocusWeek["confirmationStatus"];
  coveredCount: number;
  totalFocus: number;
  focusProjects: TodayFocusProject[];
  offFocusProjects: string[];
}

export interface TodayExecutionOutcome {
  title: string;
  subtitle: string;
  badge: string;
  targetPath?: string;
}

export type TodayCommitmentRiskKind = "blocked" | "too-many-todos" | "off-focus" | "missing-output";

export interface TodayCommitmentRisk {
  kind: TodayCommitmentRiskKind;
  text: string;
  tone: "warn" | "notice";
}

export interface TodayDecisionNeeded {
  projectId: string;
  projectName: string;
  role: FocusRole | null;
  text: string;
}

export type TodayNextActionHintKind = "focus-todo" | "focus-backlog" | "focus-next-step" | "off-focus-todo" | "off-focus-backlog";

export interface TodayNextActionHint {
  kind: TodayNextActionHintKind;
  projectId: string;
  projectName: string;
  role: FocusRole | null;
  text: string;
  backlogItem?: ProjectBacklogItem;
}

export interface TodayExecutionModel {
  outcomes: TodayExecutionOutcome[];
  focusCoverage: TodayFocusCoverage;
  offFocusProjects: string[];
  commitmentsAtRisk: TodayCommitmentRisk[];
  decisionsNeeded: TodayDecisionNeeded[];
  nextActionHints: TodayNextActionHint[];
}

export interface TodayNextAction {
  tone: "missing" | "warn" | "todo" | "pool" | "summary" | "idle";
  badge: string;
  title: string;
  reason: string;
  button: string;
  target: "today" | "project";
  projectItem?: ProjectBacklogItem;
  risks: string[];
}

export interface SelectTodayNextActionInput {
  today: TodayWorklog;
  missingLog: boolean;
  projectBacklog: ProjectBacklogItem[];
  execution: TodayExecutionModel;
  todayLogPath: string;
}

export function deriveTodayFocusCoverage(model: PortfolioModel, todayProjectNames: Set<string>): TodayFocusCoverage {
  if (model.focusWeek.confirmationStatus !== "confirmed") {
    return {
      confirmationStatus: model.focusWeek.confirmationStatus,
      coveredCount: 0,
      totalFocus: 0,
      focusProjects: [],
      offFocusProjects: [],
    };
  }

  const mentioned = new Set(Array.from(todayProjectNames, normalizeProjectKey).filter(Boolean));
  const focusProjects = model.projects
    .filter(project => project.focusRole)
    .map(project => ({
      id: project.id,
      name: project.name,
      role: project.focusRole as FocusRole,
      covered: mentioned.has(normalizeProjectKey(project.id)) || mentioned.has(normalizeProjectKey(project.name)),
    }));
  const focusKeys = new Set(focusProjects.flatMap(project => [normalizeProjectKey(project.id), normalizeProjectKey(project.name)]));
  const managedByKey = new Map<string, ManagedProject>();
  for (const project of model.projects) {
    managedByKey.set(normalizeProjectKey(project.id), project);
    managedByKey.set(normalizeProjectKey(project.name), project);
  }

  const offFocusProjects = Array.from(todayProjectNames)
    .map(name => {
      const key = normalizeProjectKey(name);
      if (!key || focusKeys.has(key)) return "";
      return managedByKey.get(key)?.name ?? "";
    })
    .filter(Boolean);

  return {
    confirmationStatus: model.focusWeek.confirmationStatus,
    coveredCount: focusProjects.filter(project => project.covered).length,
    totalFocus: focusProjects.length,
    focusProjects,
    offFocusProjects: Array.from(new Set(offFocusProjects)),
  };
}

export function deriveTodayExecution(
  today: TodayWorklog,
  portfolio: PortfolioModel,
  projectBacklog: ProjectBacklogItem[],
  focusCoverage: TodayFocusCoverage,
): TodayExecutionModel {
  const pendingTodos = today.todos.filter(todo => !todo.done);
  const blockedTexts = [
    ...pendingTodos.map(todo => todo.text),
    ...today.timeline.flatMap(item => [item.title, item.subtitle ?? "", item.raw]),
  ].filter(isActiveBlockedText);

  const commitmentsAtRisk: TodayCommitmentRisk[] = [];
  if (blockedTexts.length > 0) {
    commitmentsAtRisk.push({
      kind: "blocked",
      text: blockedTexts[0],
      tone: "warn",
    });
  }
  if (pendingTodos.length >= 5) {
    commitmentsAtRisk.push({
      kind: "too-many-todos",
      text: `${pendingTodos.length} 个未完成 Todo`,
      tone: "notice",
    });
  }
  if (focusCoverage.offFocusProjects.length > 0) {
    commitmentsAtRisk.push({
      kind: "off-focus",
      text: `Off-focus：${focusCoverage.offFocusProjects.join(" / ")}`,
      tone: "notice",
    });
  }
  if (!today.timeline.some(item => item.kind === "output")) {
    commitmentsAtRisk.push({
      kind: "missing-output",
      text: "今天还没有记录产出",
      tone: "notice",
    });
  }

  return {
    outcomes: today.timeline
      .filter(item => item.kind === "output")
      .slice(0, 3)
      .map(toTodayOutcome),
    focusCoverage,
    offFocusProjects: focusCoverage.offFocusProjects,
    commitmentsAtRisk,
    decisionsNeeded: deriveTodayDecisions(portfolio),
    nextActionHints: deriveTodayNextActionHints(today, portfolio, projectBacklog),
  };
}

export function selectTodayNextAction(input: SelectTodayNextActionInput): TodayNextAction {
  const { today, missingLog, projectBacklog, execution, todayLogPath } = input;
  const risks = nextActionRisks(today, execution);
  const blocked = execution.commitmentsAtRisk.filter(item => item.kind === "blocked");

  if (missingLog) {
    return {
      tone: "missing",
      badge: "启动",
      title: "创建今天工作日志",
      reason: todayLogPath,
      button: "创建",
      target: "today",
      risks,
    };
  }

  if (blocked.length > 0) {
    return {
      tone: "warn",
      badge: "阻塞",
      title: blocked[0].text,
      reason: `${blocked.length} 个活跃阻塞`,
      button: "打开",
      target: "today",
      risks,
    };
  }

  const preferredHint = execution.nextActionHints.find(hint => hint.kind === "focus-todo")
    ?? execution.nextActionHints.find(hint => hint.kind === "off-focus-todo")
    ?? execution.nextActionHints.find(hint => hint.kind === "focus-backlog")
    ?? execution.nextActionHints.find(hint => hint.kind === "focus-next-step")
    ?? execution.nextActionHints.find(hint => hint.kind === "off-focus-backlog");

  if (preferredHint) {
    return nextActionFromHint(preferredHint, risks);
  }

  if (projectBacklog.length > 0) {
    const item = projectBacklog[0];
    return {
      tone: "pool",
      badge: item.project,
      title: item.text,
      reason: "没有 Focus 候选，可以从项目池拉入一项",
      button: "加入今日",
      target: "project",
      projectItem: item,
      risks,
    };
  }

  if (today.timeline.length > 0 && execution.outcomes.length === 0) {
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

function normalizeProjectKey(value: string): string {
  return value.trim().toLowerCase();
}

function nextActionFromHint(hint: TodayNextActionHint, risks: string[]): TodayNextAction {
  const roleLabel = hint.role ? focusRoleLabel(hint.role) : "OFF-FOCUS";
  if (hint.kind === "focus-backlog" || hint.kind === "off-focus-backlog") {
    return {
      tone: "pool",
      badge: roleLabel,
      title: hint.text,
      reason: hint.kind === "off-focus-backlog"
        ? `${hint.projectName} · off-focus 项目池候选`
        : `${hint.projectName} · Focus 项目池候选`,
      button: "加入今日",
      target: "project",
      projectItem: hint.backlogItem,
      risks,
    };
  }
  return {
    tone: "todo",
    badge: roleLabel,
    title: hint.text,
    reason: hint.kind === "off-focus-todo"
      ? `${hint.projectName} · off-focus，低优先级`
      : `${hint.projectName} · Focus ${hint.kind === "focus-next-step" ? "下一步" : "Todo"}`,
    button: "打开",
    target: "today",
    risks,
  };
}

function toTodayOutcome(item: TimelineItem): TodayExecutionOutcome {
  return {
    title: item.title,
    subtitle: item.subtitle ?? item.time,
    badge: item.badge,
    targetPath: item.targetPath,
  };
}

function deriveTodayDecisions(portfolio: PortfolioModel): TodayDecisionNeeded[] {
  return portfolio.projects
    .flatMap(project => firstMarkdownTask(project.pendingDecisions).map(text => ({
      projectId: project.id,
      projectName: project.name,
      role: project.focusRole,
      text,
    })))
    .sort((a, b) => focusRank(a.role) - focusRank(b.role) || a.projectName.localeCompare(b.projectName))
    .slice(0, 5);
}

function deriveTodayNextActionHints(
  today: TodayWorklog,
  portfolio: PortfolioModel,
  projectBacklog: ProjectBacklogItem[],
): TodayNextActionHint[] {
  const projectsByKey = new Map<string, ManagedProject>();
  for (const project of portfolio.projects) {
    projectsByKey.set(normalizeProjectKey(project.id), project);
    projectsByKey.set(normalizeProjectKey(project.name), project);
  }

  const hints: TodayNextActionHint[] = [];
  for (const todo of today.todos.filter(item => !item.done)) {
    if (isActiveBlockedText(todo.text)) continue;
    const project = projectFromText(todo.text, projectsByKey);
    if (!project) continue;
    hints.push({
      kind: project.focusRole ? "focus-todo" : "off-focus-todo",
      projectId: project.id,
      projectName: project.name,
      role: project.focusRole,
      text: todo.text,
    });
  }

  for (const item of projectBacklog) {
    const project = projectFromText(`${item.project}：${item.text}`, projectsByKey);
    if (!project) continue;
    hints.push({
      kind: project.focusRole ? "focus-backlog" : "off-focus-backlog",
      projectId: project.id,
      projectName: project.name,
      role: project.focusRole,
      text: item.text,
      backlogItem: item,
    });
  }

  if (hints.every(hint => !hint.kind.startsWith("focus-"))) {
    const nextFocus = portfolio.projects
      .filter(project => project.focusRole && project.nextStep.trim())
      .sort((a, b) => focusRank(a.focusRole) - focusRank(b.focusRole))
      .at(0);
    if (nextFocus) {
      hints.push({
        kind: "focus-next-step",
        projectId: nextFocus.id,
        projectName: nextFocus.name,
        role: nextFocus.focusRole,
        text: compactMarkdownLine(nextFocus.nextStep),
      });
    }
  }

  return compactOffFocusHints(hints
    .sort((a, b) => nextActionHintRank(a) - nextActionHintRank(b)
      || focusRank(a.role) - focusRank(b.role)
      || a.projectName.localeCompare(b.projectName))
  ).slice(0, 6);
}

function compactOffFocusHints(hints: TodayNextActionHint[]): TodayNextActionHint[] {
  const offFocusTodoProjects = new Set(hints
    .filter(hint => hint.kind === "off-focus-todo")
    .map(hint => hint.projectId));
  return hints.filter(hint => {
    if (hint.kind === "off-focus-backlog" && offFocusTodoProjects.has(hint.projectId)) return false;
    return true;
  });
}

function nextActionHintRank(hint: TodayNextActionHint): number {
  if (hint.kind === "focus-todo") return 0;
  if (hint.kind === "focus-backlog") return 1;
  if (hint.kind === "focus-next-step") return 2;
  if (hint.kind === "off-focus-todo") return 3;
  return 4;
}

function projectFromText(text: string, projectsByKey: Map<string, ManagedProject>): ManagedProject | null {
  const explicit = projectNameFromText(text);
  if (explicit) return projectsByKey.get(normalizeProjectKey(explicit)) ?? null;
  const key = normalizeProjectKey(text);
  for (const [projectKey, project] of projectsByKey) {
    if (projectKey && key.includes(projectKey)) return project;
  }
  return null;
}

function projectNameFromText(text: string): string | null {
  const trimmed = text.trim();
  const prefix = trimmed.match(/^([A-Za-z0-9_\-\u4e00-\u9fa5]{2,32})[：:]/);
  if (prefix) return prefix[1];
  const dotted = trimmed.match(/^([A-Za-z0-9_\-\u4e00-\u9fa5]{2,32})\s+·\s+/);
  if (dotted) return dotted[1];
  return null;
}

function firstMarkdownTask(markdown: string): string[] {
  return markdown
    .split("\n")
    .map(line => line.replace(/^\s*[-*]\s+(?:\[[ xX]\]\s*)?/, "").trim())
    .filter(Boolean)
    .slice(0, 1);
}

function compactMarkdownLine(markdown: string): string {
  return markdown
    .split("\n")
    .map(line => line.replace(/^\s*[-*]\s+(?:\[[ xX]\]\s*)?/, "").trim())
    .find(Boolean) ?? "";
}

function focusRoleLabel(role: FocusRole): string {
  if (role === "main") return "主项目";
  if (role === "support") return "副项目";
  return "维护";
}

function nextActionRisks(today: TodayWorklog, execution: TodayExecutionModel): string[] {
  const risks: string[] = [];
  for (const risk of execution.commitmentsAtRisk) {
    if (risk.kind === "blocked") risks.push("1 阻塞");
    if (risk.kind === "too-many-todos") risks.push(`${today.todos.filter(todo => !todo.done).length} 待办`);
    if (risk.kind === "off-focus") risks.push("off-focus");
    if (risk.kind === "missing-output") risks.push("无产出");
  }
  if (!today.timeline.some(item => item.kind === "git")) risks.push("无 Git");
  return Array.from(new Set(risks)).slice(0, 3);
}

function isActiveBlockedText(text: string): boolean {
  return isBlockedText(text) && !isResolvedBlockedText(text);
}

function isBlockedText(text: string): boolean {
  return /(^|[\s\-*◆：:])(?:阻塞|等待|卡住)\s*[：:]|(^|[\s\-*◆：:])blocked\s*(?::|by\b)/i.test(text);
}

function isResolvedBlockedText(text: string): boolean {
  if (/已解决|已解除|已处理|✅/i.test(text)) return true;
  if (/未完成|没完成|没有完成|尚未完成/.test(text)) return false;
  return /完成/.test(text);
}
