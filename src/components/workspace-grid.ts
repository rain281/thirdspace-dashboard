import type { WorkspaceStats } from "../data/vault-reader";

const WORKSPACE_ICONS: Record<string, string> = {
  "00-系统": "⚙️",
  "01-收件箱": "📥",
  "02-日记": "📔",
  "03-知识": "🧠",
  "04-项目": "🚀",
  "05-资源": "📦",
  "06-输出": "✍️",
  "99-归档": "🗄️",
};

function timeAgo(ms: number): string {
  if (ms === 0) return "never";
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function healthColor(stats: WorkspaceStats): string {
  if (stats.fileCount === 0) return "ts-health-empty";
  const daysSinceActivity = (Date.now() - stats.lastModified) / 86400000;
  if (daysSinceActivity < 7) return "ts-health-active";
  if (daysSinceActivity < 30) return "ts-health-recent";
  return "ts-health-stale";
}

export function renderWorkspaceGrid(
  container: HTMLElement,
  stats: WorkspaceStats[]
): void {
  container.empty();

  const grid = container.createDiv({ cls: "ts-workspace-grid" });

  for (const ws of stats) {
    const card = grid.createDiv({ cls: `ts-workspace-card ${healthColor(ws)}` });

    const header = card.createDiv({ cls: "ts-ws-header" });
    header.createSpan({ cls: "ts-ws-icon", text: WORKSPACE_ICONS[ws.dir] || "📁" });
    header.createSpan({ cls: "ts-ws-name", text: ws.dir });

    const count = card.createDiv({ cls: "ts-ws-count" });
    count.createSpan({ cls: "ts-ws-number", text: String(ws.fileCount) });
    count.createSpan({ cls: "ts-ws-label", text: " files" });

    card.createDiv({
      cls: "ts-ws-time",
      text: timeAgo(ws.lastModified),
    });

    // Mini bar: visual weight indicator
    const bar = card.createDiv({ cls: "ts-ws-bar" });
    const maxFiles = Math.max(...stats.map(s => s.fileCount), 1);
    bar.createDiv({
      cls: "ts-ws-bar-fill",
      attr: { style: `width: ${Math.round((ws.fileCount / maxFiles) * 100)}%` },
    });
  }
}
