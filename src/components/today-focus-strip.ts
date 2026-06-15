import type { TodayFocusCoverage } from "../data/project-management";

export function renderTodayFocusStrip(parent: HTMLElement, coverage: TodayFocusCoverage): void {
  const wrap = parent.createDiv({
    cls: `ts-today-focus-strip${coverage.offFocusProjects.length > 0 ? " has-off-focus" : ""}`,
  });
  const head = wrap.createSpan({ cls: "ts-today-focus-strip-head" });
  head.createSpan({ cls: "ts-today-focus-strip-title", text: "本周焦点" });
  head.createSpan({
    cls: "ts-today-focus-strip-count",
    text: coverage.totalFocus > 0 ? `${coverage.coveredCount}/${coverage.totalFocus}` : "待确认",
  });

  wrap.createSpan({ cls: "ts-today-focus-strip-text", text: todayFocusStripText(coverage) });
}

function todayFocusStripText(coverage: TodayFocusCoverage): string {
  if (coverage.totalFocus === 0) {
    return coverage.confirmationStatus === "confirmed" ? "暂无本周焦点" : "本周焦点待确认";
  }

  const covered = coverage.focusProjects.filter(project => project.covered).map(project => project.name);
  const missing = coverage.focusProjects.filter(project => !project.covered).map(project => project.name);
  const parts = [
    covered.length > 0 ? `${covered.join(" / ")} 已覆盖` : "暂无焦点覆盖",
    missing.length > 0 ? `${missing.join(" / ")} 未覆盖` : "焦点已全部覆盖",
  ];
  if (coverage.offFocusProjects.length > 0) parts.push(`插队 ${coverage.offFocusProjects.join(" / ")}`);
  return parts.join(" · ");
}
