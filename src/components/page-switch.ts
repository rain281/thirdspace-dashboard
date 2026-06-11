export type DashboardPage = "today" | "projects" | "review" | "system";

export const DASHBOARD_PAGES: Array<{ id: DashboardPage; label: string; icon: string }> = [
  { id: "today", label: "今日工作", icon: "calendar-check" },
  { id: "projects", label: "项目系统", icon: "folder-kanban" },
  { id: "review", label: "复盘", icon: "clipboard-check" },
  { id: "system", label: "系统", icon: "settings-2" },
];
