import type {
  WeeklyReviewFocusItem,
  WeeklyReviewModel,
  WeeklyReviewOutcome,
  WeeklyReviewProposalItem,
  WeeklyReviewTextItem,
} from "../data/weekly-review";

export interface WeeklyReviewActions {
  onWriteWeeklyReview?(): void;
}

export function renderWeeklyReview(parent: HTMLElement, model: WeeklyReviewModel, actions: WeeklyReviewActions = {}): void {
  renderSummary(parent.createDiv({ cls: "ts-board-col ts-review-summary-col" }), model, actions);
  renderFocus(parent.createDiv({ cls: "ts-board-col ts-review-focus-col" }), model.focusItems);
  renderOutcomes(parent.createDiv({ cls: "ts-board-col ts-review-outcomes-col" }), model.outcomes);
  renderOffFocus(parent.createDiv({ cls: "ts-board-col ts-review-offfocus-col" }), model);
  renderRisksAndDecisions(parent.createDiv({ cls: "ts-board-col ts-review-risks-col" }), model);
  renderNextWeek(parent.createDiv({ cls: "ts-board-col ts-review-next-col" }), model);
}

function renderSummary(parent: HTMLElement, model: WeeklyReviewModel, actions: WeeklyReviewActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-review-summary-card" });
  const head = card.createDiv({ cls: "ts-card-head" });
  head.createSpan({ cls: "ts-card-label", text: "周复盘" });
  head.createSpan({ cls: "ts-card-meta", text: `${model.week} · ${model.worklogCount} 篇日志` });
  if (actions.onWriteWeeklyReview) {
    const btn = card.createEl("button", { cls: "ts-review-write-btn", text: "写入周复盘" });
    btn.addEventListener("click", event => {
      event.stopPropagation();
      actions.onWriteWeeklyReview?.();
    });
  }
  const grid = card.createDiv({ cls: "ts-review-metrics" });
  metric(grid, `${model.focusItems.filter(item => item.hasProgress).length}/${model.focusItems.length}`, "焦点推进");
  metric(grid, String(model.outcomes.length), "产出");
  metric(grid, String(model.offFocus.count), "非焦点");
  metric(grid, String(model.risks.open.length), "开放风险");
  metric(grid, String(model.decisions.pending.length), "待决策");
}

function renderFocus(parent: HTMLElement, items: WeeklyReviewFocusItem[]): void {
  const card = sectionCard(parent, "焦点复盘", "ts-review-focus-card");
  if (items.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "暂无已确认的本周焦点" });
    return;
  }
  const list = card.createDiv({ cls: "ts-review-focus-grid" });
  for (const item of items) {
    const row = list.createDiv({ cls: `ts-review-focus-cardlet ts-review-row--focus ${item.hasProgress ? "is-moving" : "is-stalled"}` });
    row.createSpan({ cls: "ts-review-badge", text: item.roleLabel });
    const info = row.createDiv({ cls: "ts-review-info" });
    info.createDiv({ cls: "ts-review-title", text: item.name });
    info.createDiv({ cls: "ts-review-sub", text: `${item.status} · ${item.summary}` });
  }
}

function renderOutcomes(parent: HTMLElement, outcomes: WeeklyReviewOutcome[]): void {
  const card = sectionCard(parent, "本周产出", "ts-review-outcomes-card");
  if (outcomes.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "暂无本周产出" });
    return;
  }
  const list = card.createDiv({ cls: "ts-review-list" });
  for (const outcome of outcomes.slice(0, 6)) {
    const row = list.createDiv({ cls: "ts-review-row ts-review-row--outcome" });
    row.createSpan({ cls: "ts-review-badge", text: outcome.projectName });
    const info = row.createDiv({ cls: "ts-review-info" });
    info.createDiv({ cls: "ts-review-title", text: outcome.title });
    info.createDiv({ cls: "ts-review-sub", text: outcome.sourcePath });
  }
}

function renderOffFocus(parent: HTMLElement, model: WeeklyReviewModel): void {
  const card = sectionCard(parent, "非焦点", "ts-review-offfocus-card");
  if (model.offFocus.events.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "暂无非焦点事件" });
    return;
  }
  const list = card.createDiv({ cls: "ts-review-list" });
  for (const event of model.offFocus.events.slice(0, 5)) {
    const row = list.createDiv({ cls: "ts-review-row ts-review-row--offfocus" });
    row.createSpan({ cls: "ts-review-badge", text: event.date });
    const info = row.createDiv({ cls: "ts-review-info" });
    info.createDiv({ cls: "ts-review-title", text: event.projectName });
    info.createDiv({ cls: "ts-review-sub", text: [event.reason, event.target].filter(Boolean).join(" · ") });
  }
}

function renderRisksAndDecisions(parent: HTMLElement, model: WeeklyReviewModel): void {
  const card = sectionCard(parent, "风险 / 决策", "ts-review-risks-card");
  const open = card.createDiv({ cls: "ts-review-mini-section" });
  open.createDiv({ cls: "ts-review-mini-head", text: "未关闭" });
  renderTextItems(open, [...model.risks.open, ...model.decisions.pending], "暂无未关闭风险或待决策");

  const closed = card.createDiv({ cls: "ts-review-mini-section" });
  closed.createDiv({ cls: "ts-review-mini-head", text: "已关闭 / 已决策" });
  renderTextItems(closed, [...model.risks.closed, ...model.decisions.made], "暂无已关闭风险或已决策事项");
}

function renderNextWeek(parent: HTMLElement, model: WeeklyReviewModel): void {
  const card = sectionCard(parent, "下周建议", "ts-review-next-card");
  card.createDiv({ cls: "ts-review-next-summary", text: model.nextWeekProposal.summary });
  if (model.nextWeekProposal.items.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "暂无下周建议" });
    return;
  }
  const list = card.createDiv({ cls: "ts-review-list" });
  for (const item of model.nextWeekProposal.items) renderProposal(list, item);
}

function renderTextItems(parent: HTMLElement, items: WeeklyReviewTextItem[], empty: string): void {
  if (items.length === 0) {
    parent.createDiv({ cls: "ts-empty ts-review-empty", text: empty });
    return;
  }
  const list = parent.createDiv({ cls: "ts-review-list ts-review-list--compact" });
  for (const item of items.slice(0, 5)) {
    const row = list.createDiv({ cls: "ts-review-row ts-review-row--text" });
    row.createSpan({ cls: "ts-review-badge", text: item.projectName });
    row.createDiv({ cls: "ts-review-title", text: item.text });
  }
}

function renderProposal(parent: HTMLElement, item: WeeklyReviewProposalItem): void {
  const row = parent.createDiv({ cls: `ts-review-row ts-review-row--proposal ts-review-row--${item.action}` });
  row.createSpan({ cls: "ts-review-badge", text: proposalLabel(item.action) });
  const info = row.createDiv({ cls: "ts-review-info" });
  info.createDiv({ cls: "ts-review-title", text: item.projectName });
  info.createDiv({ cls: "ts-review-sub", text: item.reason });
}

function sectionCard(parent: HTMLElement, label: string, cls: string): HTMLElement {
  const card = parent.createDiv({ cls: `ts-card ts-review-section ${cls}` });
  card.createDiv({ cls: "ts-card-label", text: label });
  return card;
}

function metric(parent: HTMLElement, value: string, label: string): void {
  const item = parent.createDiv({ cls: "ts-review-metric" });
  item.createDiv({ cls: "ts-review-metric-value", text: value });
  item.createDiv({ cls: "ts-review-metric-label", text: label });
}

function proposalLabel(action: WeeklyReviewProposalItem["action"]): string {
  if (action === "continue") return "继续";
  if (action === "watch") return "检查";
  return "调整";
}
