import type {
  TodayCommitmentRisk,
  TodayDecisionNeeded,
  TodayExecutionModel,
  TodayExecutionOutcome,
} from "../data/project-management";

export interface TodayExecutionActions {
  openToday: () => void;
}

export function renderTodayExecution(
  parent: HTMLElement,
  execution: TodayExecutionModel,
  actions: TodayExecutionActions,
): void {
  const wrap = parent.createDiv({ cls: "ts-today-exec" });
  renderOutcomes(wrap, execution.outcomes, actions);
  renderRisks(wrap, execution.commitmentsAtRisk, actions);
  renderDecisions(wrap, execution.decisionsNeeded, actions);
}

function renderOutcomes(parent: HTMLElement, outcomes: TodayExecutionOutcome[], actions: TodayExecutionActions): void {
  const section = createSection(parent, "今日产出");
  if (outcomes.length === 0) {
    section.createDiv({ cls: "ts-empty ts-today-exec-empty", text: "写入 ## 今日产出 后显示结果" });
    return;
  }
  const list = section.createDiv({ cls: "ts-today-exec-list" });
  for (const outcome of outcomes) {
    const row = list.createDiv({ cls: "ts-today-exec-row ts-today-exec-row--outcome" });
    row.addEventListener("click", actions.openToday);
    row.createSpan({ cls: "ts-today-exec-badge", text: outcome.badge || "output" });
    const info = row.createDiv({ cls: "ts-today-exec-info" });
    info.createDiv({ cls: "ts-today-exec-title", text: outcome.title });
    if (outcome.subtitle) info.createDiv({ cls: "ts-today-exec-sub", text: outcome.subtitle });
  }
}

function renderRisks(parent: HTMLElement, risks: TodayCommitmentRisk[], actions: TodayExecutionActions): void {
  const section = createSection(parent, "执行风险");
  if (risks.length === 0) {
    section.createDiv({ cls: "ts-empty ts-today-exec-empty", text: "暂无执行风险" });
    return;
  }
  const list = section.createDiv({ cls: "ts-today-exec-list" });
  for (const risk of risks) {
    const row = list.createDiv({ cls: `ts-today-exec-row ts-today-exec-row--risk ts-today-exec-row--${risk.tone}` });
    row.addEventListener("click", actions.openToday);
    row.createSpan({ cls: "ts-today-exec-badge", text: riskLabel(risk.kind) });
    row.createDiv({ cls: "ts-today-exec-title", text: risk.text });
  }
}

function renderDecisions(parent: HTMLElement, decisions: TodayDecisionNeeded[], actions: TodayExecutionActions): void {
  const section = createSection(parent, "待决策");
  if (decisions.length === 0) {
    section.createDiv({ cls: "ts-empty ts-today-exec-empty", text: "暂无待决策" });
    return;
  }
  const list = section.createDiv({ cls: "ts-today-exec-list" });
  for (const decision of decisions) {
    const row = list.createDiv({ cls: "ts-today-exec-row ts-today-exec-row--decision" });
    row.addEventListener("click", actions.openToday);
    row.createSpan({ cls: "ts-today-exec-badge", text: decision.role ? roleLabel(decision.role) : "watch" });
    const info = row.createDiv({ cls: "ts-today-exec-info" });
    info.createDiv({ cls: "ts-today-exec-title", text: decision.projectName });
    info.createDiv({ cls: "ts-today-exec-sub", text: decision.text });
  }
}

function createSection(parent: HTMLElement, title: string): HTMLElement {
  const section = parent.createDiv({ cls: "ts-today-exec-section" });
  section.createDiv({ cls: "ts-today-exec-head", text: title });
  return section;
}

function riskLabel(kind: TodayCommitmentRisk["kind"]): string {
  if (kind === "blocked") return "阻塞";
  if (kind === "too-many-todos") return "负载";
  if (kind === "off-focus") return "偏离";
  return "产出";
}

function roleLabel(role: NonNullable<TodayDecisionNeeded["role"]>): string {
  if (role === "main") return "主";
  if (role === "support") return "副";
  return "维";
}
