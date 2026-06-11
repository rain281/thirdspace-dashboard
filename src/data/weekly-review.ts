import type { TimelineItem, TodayWorklog } from "./vault-reader";
import {
  currentIsoWeek,
  type FocusRole,
  type ManagedProject,
  type PortfolioModel,
} from "./project-management";

export interface WeeklyWorklogSnapshot {
  date: string;
  path: string;
  worklog: TodayWorklog;
}

export interface WeeklyReviewFocusItem {
  projectId: string;
  name: string;
  role: FocusRole;
  roleLabel: string;
  hasProgress: boolean;
  outcomeCount: number;
  status: "推进" | "未推进";
  summary: string;
}

export interface WeeklyReviewOutcome {
  title: string;
  projectName: string;
  sourcePath: string;
  badge: string;
}

export interface WeeklyReviewOffFocusEvent {
  date: string;
  projectId: string;
  projectName: string;
  reason: string;
  target: string;
}

export interface WeeklyReviewTextItem {
  projectName: string;
  text: string;
}

export interface WeeklyReviewProposalItem {
  projectId: string;
  projectName: string;
  role: FocusRole | null;
  action: "continue" | "watch" | "reconsider";
  reason: string;
}

export interface WeeklyReviewModel {
  week: string;
  worklogCount: number;
  focusItems: WeeklyReviewFocusItem[];
  outcomes: WeeklyReviewOutcome[];
  offFocus: {
    count: number;
    events: WeeklyReviewOffFocusEvent[];
  };
  risks: {
    open: WeeklyReviewTextItem[];
    closed: WeeklyReviewTextItem[];
  };
  decisions: {
    pending: WeeklyReviewTextItem[];
    made: WeeklyReviewTextItem[];
  };
  nextWeekProposal: {
    summary: string;
    items: WeeklyReviewProposalItem[];
  };
}

export function deriveWeeklyReview(
  portfolio: PortfolioModel,
  worklogs: WeeklyWorklogSnapshot[],
  now = new Date(),
): WeeklyReviewModel {
  const week = portfolio.focusWeek.week || currentIsoWeek(now);
  const outcomes = weeklyOutcomes(portfolio, worklogs);
  const focusItems = portfolio.projects
    .filter(project => project.focusRole)
    .map(project => focusReviewItem(project, outcomes));
  const offFocusEvents = portfolio.focusWeek.offFocusEvents.map(event => ({
    date: event.date,
    projectId: event.projectId,
    projectName: projectName(portfolio, event.projectId),
    reason: event.reason,
    target: event.target,
  }));

  const openRisks = portfolio.projects.flatMap(project => markdownTasks(project.name, project.risks, "open"));
  const closedRisks = portfolio.projects.flatMap(project => markdownTasks(project.name, project.risks, "closed"));
  const pendingDecisions = portfolio.projects.flatMap(project => markdownTasks(project.name, project.pendingDecisions, "open"));
  const madeDecisions = decisionItemsFromWorklogs(worklogs);

  return {
    week,
    worklogCount: worklogs.length,
    focusItems,
    outcomes,
    offFocus: {
      count: offFocusEvents.length,
      events: offFocusEvents,
    },
    risks: {
      open: openRisks.slice(0, 6),
      closed: closedRisks.slice(0, 4),
    },
    decisions: {
      pending: pendingDecisions.slice(0, 6),
      made: madeDecisions.slice(0, 4),
    },
    nextWeekProposal: nextWeekProposal(portfolio, focusItems, openRisks, pendingDecisions),
  };
}

function focusReviewItem(project: ManagedProject, outcomes: WeeklyReviewOutcome[]): WeeklyReviewFocusItem {
  const outcomeCount = outcomes.filter(outcome => sameProject(outcome.projectName, project)).length;
  return {
    projectId: project.id,
    name: project.name,
    role: project.focusRole as FocusRole,
    roleLabel: focusRoleLabel(project.focusRole as FocusRole),
    hasProgress: outcomeCount > 0,
    outcomeCount,
    status: outcomeCount > 0 ? "推进" : "未推进",
    summary: outcomeCount > 0 ? `${outcomeCount} 个产出` : "本周没有产出",
  };
}

function weeklyOutcomes(portfolio: PortfolioModel, worklogs: WeeklyWorklogSnapshot[]): WeeklyReviewOutcome[] {
  return worklogs
    .flatMap(snapshot => snapshot.worklog.timeline
      .filter(item => item.kind === "output")
      .map(item => outcomeFromTimelineItem(portfolio, item)))
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))
    .slice(0, 8);
}

function outcomeFromTimelineItem(portfolio: PortfolioModel, item: TimelineItem): WeeklyReviewOutcome {
  return {
    title: item.title,
    projectName: projectNameFromText(portfolio, item.title) || projectNameFromText(portfolio, item.raw) || "未归属",
    sourcePath: item.sourcePath,
    badge: item.badge,
  };
}

function projectNameFromText(portfolio: PortfolioModel, text: string): string {
  const normalized = text.toLowerCase();
  const found = portfolio.projects.find(project => normalized.includes(project.name.toLowerCase()) || normalized.includes(project.id.toLowerCase()));
  if (found) return found.name;
  const prefix = text.match(/^([^：:]{2,32})[：:]/)?.[1]?.trim() ?? "";
  return prefix;
}

function projectName(portfolio: PortfolioModel, projectId: string): string {
  return portfolio.projects.find(project => project.id === projectId)?.name ?? projectId;
}

function sameProject(projectNameValue: string, project: ManagedProject): boolean {
  const normalized = projectNameValue.toLowerCase();
  return normalized === project.name.toLowerCase() || normalized === project.id.toLowerCase();
}

function markdownTasks(projectNameValue: string, markdown: string, mode: "open" | "closed"): WeeklyReviewTextItem[] {
  const items: WeeklyReviewTextItem[] = [];
  for (const line of markdown.split("\n")) {
    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)/);
    const bullet = line.match(/^\s*[-*]\s+(?!\[[ xX]\]\s)(.+)/);
    const isClosed = task?.[1]?.toLowerCase() === "x" || /已解决|已解除|✅/.test(line);
    if (mode === "open" && isClosed) continue;
    if (mode === "closed" && !isClosed) continue;
    const raw = task?.[2] ?? bullet?.[1];
    const text = cleanMarkdownLine(raw ?? "");
    if (text) items.push({ projectName: projectNameValue, text });
  }
  return items;
}

function decisionItemsFromWorklogs(worklogs: WeeklyWorklogSnapshot[]): WeeklyReviewTextItem[] {
  return worklogs.flatMap(snapshot => snapshot.worklog.timeline)
    .filter(item => /决策|决定|采用|确认/.test([item.title, item.raw].join(" ")))
    .map(item => ({
      projectName: item.title.match(/^([^：:]{2,32})[：:]/)?.[1]?.trim() ?? "工作日志",
      text: cleanMarkdownLine(item.title),
    }));
}

function nextWeekProposal(
  portfolio: PortfolioModel,
  focusItems: WeeklyReviewFocusItem[],
  openRisks: WeeklyReviewTextItem[],
  pendingDecisions: WeeklyReviewTextItem[],
): WeeklyReviewModel["nextWeekProposal"] {
  const riskProjects = new Set(openRisks.map(item => item.projectName));
  const decisionProjects = new Set(pendingDecisions.map(item => item.projectName));
  const items: WeeklyReviewProposalItem[] = focusItems.map(item => {
    if (!item.hasProgress) {
      return {
        projectId: item.projectId,
        projectName: item.name,
        role: item.role,
        action: "reconsider",
        reason: "本周没有产出，建议暂停或降级",
      };
    }
    if (riskProjects.has(item.name) || decisionProjects.has(item.name)) {
      return {
        projectId: item.projectId,
        projectName: item.name,
        role: item.role,
        action: "watch",
        reason: "本周有推进，但仍有风险或待决策",
      };
    }
    return {
      projectId: item.projectId,
      projectName: item.name,
      role: item.role,
      action: "continue",
      reason: `${item.roleLabel}有产出，可继续推进`,
    };
  });

  const main = focusItems.find(item => item.role === "main") ?? focusItems[0];
  const summary = main
    ? `继续主项目 ${main.name}，并检查未推进 Focus。`
    : portfolio.focusWeek.confirmationStatus === "confirmed"
      ? "本周 Focus 未设置，建议先确认下周主项目。"
      : "Weekly Focus 尚未确认，建议先确认下周主 / 副 / 维护项目。";

  return { summary, items };
}

function focusRoleLabel(role: FocusRole): string {
  if (role === "main") return "主项目";
  if (role === "support") return "副项目";
  return "维护项目";
}

function cleanMarkdownLine(text: string): string {
  return text
    .replace(/✅ \d{4}-\d{2}-\d{2}/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .trim();
}
