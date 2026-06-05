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
