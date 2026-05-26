export interface QuickAction {
  label: string;
  icon: string;
  intent: string;
  workspace: string;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  { label: "New Note",     icon: "✍️",  intent: "记一条笔记",     workspace: "03-知识" },
  { label: "Work Log",     icon: "📋",  intent: "记录工作日志",   workspace: "02-日记" },
  { label: "Reflection",   icon: "🪞",  intent: "写一篇反思",     workspace: "02-日记" },
  { label: "New Project",  icon: "🚀",  intent: "创建新项目",     workspace: "04-项目" },
  { label: "Weekly Review",icon: "📊",  intent: "做周复盘",       workspace: "02-日记" },
];

export function renderQuickActions(
  container: HTMLElement,
  onAction: (action: QuickAction) => void
): void {
  container.empty();

  const grid = container.createDiv({ cls: "ts-actions-grid" });

  for (const action of DEFAULT_ACTIONS) {
    const btn = grid.createEl("button", { cls: "ts-action-btn" });
    btn.createSpan({ cls: "ts-action-icon", text: action.icon });
    btn.createSpan({ cls: "ts-action-label", text: action.label });
    btn.addEventListener("click", () => onAction(action));
  }
}
