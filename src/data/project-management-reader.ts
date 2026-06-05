import type { App } from "obsidian";
import { loadProjectIndex } from "./vault-reader";
import {
  FOCUS_WEEK_PATH,
  deriveManagedProjects,
  derivePortfolioSummary,
  parseFocusWeekYaml,
  parseProjectStatusMarkdown,
  type ParsedProjectStatus,
  type PortfolioModel,
  type ProjectIndexLike,
} from "./project-management";

export async function loadPortfolioModel(app: App, now = new Date()): Promise<PortfolioModel> {
  const [projects, focusContent] = await Promise.all([
    loadProjectIndex(app),
    readOptional(app, FOCUS_WEEK_PATH),
  ]);
  const focusWeek = parseFocusWeekYaml(focusContent ?? "", now);
  const statuses = await loadProjectStatuses(app, projects);
  const managedProjects = deriveManagedProjects({
    projects,
    statuses,
    focusWeek,
    now,
  });

  return {
    focusWeek,
    projects: managedProjects,
    summary: derivePortfolioSummary(managedProjects, focusWeek),
  };
}

async function loadProjectStatuses(app: App, projects: ProjectIndexLike[]): Promise<Map<string, ParsedProjectStatus>> {
  const entries = await Promise.all(projects.map(async project => {
    if (!project.status_note) return null;
    const markdown = await readOptional(app, project.status_note);
    if (!markdown) return null;
    const status = parseProjectStatusMarkdown(markdown, project.status_note);
    return [project.id, status] as const;
  }));

  return new Map(entries.filter((entry): entry is readonly [string, ParsedProjectStatus] => entry !== null));
}

async function readOptional(app: App, path: string): Promise<string | null> {
  try {
    return await app.vault.adapter.read(path);
  } catch {
    return null;
  }
}
