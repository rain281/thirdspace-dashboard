export function renderRecentActivity(
  container: HTMLElement,
  files: Array<{ path: string; name: string; workspace: string; modified: number }>,
  onOpen: (path: string) => void
): void {
  container.empty();

  if (files.length === 0) {
    container.createDiv({ cls: "ts-empty-hint", text: "No recent activity" });
    return;
  }

  const list = container.createDiv({ cls: "ts-recent-list" });

  for (const file of files) {
    const row = list.createDiv({ cls: "ts-recent-row" });
    row.addEventListener("click", () => onOpen(file.path));

    const ws = row.createSpan({ cls: "ts-recent-ws", text: file.workspace.replace(/^\d+-/, "") });

    const name = row.createSpan({ cls: "ts-recent-name", text: file.name });

    const time = row.createSpan({
      cls: "ts-recent-time",
      text: formatRelativeTime(file.modified),
    });
  }
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
