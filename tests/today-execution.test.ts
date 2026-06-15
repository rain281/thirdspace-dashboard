import assert from "node:assert/strict";
import {
  deriveTodayExecution,
  selectTodayNextAction,
  type ManagedProject,
  type PortfolioModel,
  type TodayFocusCoverage,
} from "../src/data/project-management";
import type { ProjectBacklogItem, TimelineItem, TodayWorklog } from "../src/data/vault-reader";

function timelineItem(kind: TimelineItem["kind"], title: string, raw = title): TimelineItem {
  return {
    id: `${kind}-${title}`,
    kind,
    time: "10:00",
    timestamp: 1,
    title,
    body: [],
    raw,
    sourcePath: "02-日记/工作日志/20260611_工作日志_周四.md",
    badge: kind,
  };
}

function project(overrides: Partial<ManagedProject>): ManagedProject {
  return {
    id: "kora",
    name: "Kora",
    category: "产品系统",
    lifecycle: "active",
    priority: "P0",
    stage: "构建",
    workspace: "04-项目/产品系统/Kora",
    repoPath: "/Volumes/资料/projects/Kora",
    projectHome: "04-项目/产品系统/Kora/首页.md",
    statusNote: "04-项目/产品系统/Kora/Kora项目状态.md",
    codexContext: "04-项目/产品系统/Kora/Kora-Codex上下文.md",
    goal: "构建本地工作台",
    successCriteria: "Today 能判断下一步",
    milestone: "Phase 6",
    nextStep: "- [ ] Kora：实现 Today execution model",
    risks: "",
    pendingDecisions: "",
    deliveryGates: "- [ ] npm run build",
    recentStatus: "Phase 6 计划已确认",
    updated: "2026-06-11",
    focusRole: null,
    focusReason: "",
    health: { status: "健康", reasons: [] },
    ...overrides,
  };
}

const portfolio: PortfolioModel = {
  focusWeek: {
    week: "2026-W24",
    confirmationStatus: "confirmed",
    focusLimit: 3,
    focusProjects: [
      { id: "kora", role: "main", reason: "主项目" },
      { id: "pilot", role: "support", reason: "副项目" },
      { id: "aidv", role: "maintenance", reason: "维护项目" },
    ],
    offFocusPolicy: "allow_today_with_reason",
    offFocusEvents: [],
  },
  summary: {
    totalManaged: 4,
    activeCount: 2,
    watchCount: 2,
    focusLimit: 3,
    focusUsed: 3,
    riskCount: 1,
    attentionCount: 1,
    staleCount: 0,
    noNextStepCount: 0,
    deliveryGateGapCount: 0,
  },
  projects: [
    project({ id: "kora", name: "Kora", focusRole: "main" }),
    project({
      id: "pilot",
      name: "Pilot",
      focusRole: "support",
      pendingDecisions: "- [ ] 是否先做 Mail.app 权限",
      priority: "P1",
    }),
    project({
      id: "aidv",
      name: "AIDV",
      lifecycle: "watch",
      focusRole: "maintenance",
      pendingDecisions: "- [ ] 是否进入 active",
      priority: "P2",
    }),
    project({
      id: "comic-drama",
      name: "AI漫剧",
      lifecycle: "watch",
      focusRole: null,
      pendingDecisions: "- [ ] 是否进入本周 Focus",
      priority: "P2",
    }),
  ],
};

const focusCoverage: TodayFocusCoverage = {
  confirmationStatus: "confirmed",
  coveredCount: 1,
  totalFocus: 3,
  focusProjects: [
    { id: "kora", name: "Kora", role: "main", covered: true },
    { id: "pilot", name: "Pilot", role: "support", covered: false },
    { id: "aidv", name: "AIDV", role: "maintenance", covered: false },
  ],
  offFocusProjects: ["AI漫剧"],
};

const today: TodayWorklog = {
  highlights: [],
  todos: [
    { text: "Kora：完成 Today execution model", done: false },
    { text: "AI漫剧：临时整理设定", done: false },
    { text: "Pilot：等待 Mail.app 权限确认", done: false },
    { text: "AIDV：blocked by reviewer", done: false },
    { text: "整理收件箱", done: false },
    { text: "补写日志", done: false },
  ],
  entries: [],
  outputs: [],
  events: [],
  timeline: [
    timelineItem("output", "完成 Phase 6 计划"),
    timelineItem("record", "Kora：推进 Today execution model"),
    timelineItem("output", "部署 Dashboard detail"),
    timelineItem("output", "记录 Focus 确认"),
    timelineItem("output", "额外产出不应显示"),
  ],
};

const backlog: ProjectBacklogItem[] = [
  {
    project: "Kora",
    text: "Kora：实现 Focus 优先级",
    path: "04-项目/产品系统/Kora/未完成事项.md",
    source: "04-项目/产品系统/Kora/未完成事项.md",
  },
  {
    project: "AI漫剧",
    text: "整理 prompt",
    path: "04-项目/内容创作/AI漫剧/未完成事项.md",
    source: "04-项目/内容创作/AI漫剧/未完成事项.md",
  },
];

const execution = deriveTodayExecution(today, portfolio, backlog, focusCoverage);

assert.deepEqual(execution.outcomes.map(item => item.title), [
  "完成 Phase 6 计划",
  "部署 Dashboard detail",
  "记录 Focus 确认",
]);
assert.equal(execution.focusCoverage.coveredCount, 1);
assert.deepEqual(execution.focusCoverage.focusProjects.map(item => [item.name, item.role, item.covered]), [
  ["Kora", "main", true],
  ["Pilot", "support", false],
  ["AIDV", "maintenance", false],
]);
assert.deepEqual(execution.offFocusProjects, ["AI漫剧"]);
assert.deepEqual(execution.commitmentsAtRisk.map(item => item.kind), [
  "blocked",
  "too-many-todos",
  "off-focus",
]);
assert.ok(execution.commitmentsAtRisk.some(item => item.text.includes("blocked by reviewer")));
assert.ok(execution.commitmentsAtRisk.some(item => item.text.includes("6 个未完成 Todo")));
assert.ok(execution.commitmentsAtRisk.some(item => item.text.includes("AI漫剧")));
assert.deepEqual(execution.decisionsNeeded.map(item => [item.projectName, item.role]), [
  ["Pilot", "support"],
  ["AIDV", "maintenance"],
  ["AI漫剧", null],
]);
assert.deepEqual(execution.nextActionHints.map(item => [item.kind, item.projectName]), [
  ["focus-todo", "Kora"],
  ["focus-todo", "Pilot"],
  ["focus-backlog", "Kora"],
  ["off-focus-todo", "AI漫剧"],
]);

const noOutputExecution = deriveTodayExecution(
  { ...today, timeline: today.timeline.filter(item => item.kind !== "output") },
  portfolio,
  [],
  { ...focusCoverage, offFocusProjects: [] },
);

assert.ok(noOutputExecution.commitmentsAtRisk.some(item => item.kind === "missing-output"));

const blockedAction = selectTodayNextAction({
  today,
  missingLog: false,
  projectBacklog: backlog,
  execution,
  todayLogPath: "02-日记/工作日志/20260611_工作日志_周四.md",
});

assert.equal(blockedAction.tone, "warn");
assert.equal(blockedAction.badge, "阻塞");
assert.match(blockedAction.title, /blocked by reviewer/);

const focusTodoToday: TodayWorklog = {
  ...today,
  todos: [
    { text: "AI漫剧：临时整理设定", done: false },
    { text: "Kora：完成 Today execution model", done: false },
  ],
};
const focusTodoExecution = deriveTodayExecution(focusTodoToday, portfolio, backlog, {
  ...focusCoverage,
  offFocusProjects: ["AI漫剧"],
});
const focusTodoAction = selectTodayNextAction({
  today: focusTodoToday,
  missingLog: false,
  projectBacklog: backlog,
  execution: focusTodoExecution,
  todayLogPath: "02-日记/工作日志/20260611_工作日志_周四.md",
});

assert.equal(focusTodoAction.tone, "todo");
assert.equal(focusTodoAction.title, "Kora：完成 Today execution model");
assert.match(focusTodoAction.reason, /焦点/);

const backlogFirstOffFocus = [
  backlog[1],
  backlog[0],
];
const noPendingToday: TodayWorklog = {
  ...today,
  todos: [],
};
const focusBacklogExecution = deriveTodayExecution(noPendingToday, portfolio, backlogFirstOffFocus, {
  ...focusCoverage,
  offFocusProjects: [],
});
const focusBacklogAction = selectTodayNextAction({
  today: noPendingToday,
  missingLog: false,
  projectBacklog: backlogFirstOffFocus,
  execution: focusBacklogExecution,
  todayLogPath: "02-日记/工作日志/20260611_工作日志_周四.md",
});

assert.equal(focusBacklogAction.tone, "pool");
assert.equal(focusBacklogAction.projectItem?.project, "Kora");
assert.match(focusBacklogAction.reason, /焦点/);

const projectNextStepExecution = deriveTodayExecution(noPendingToday, portfolio, [], {
  ...focusCoverage,
  offFocusProjects: [],
});
const projectNextStepAction = selectTodayNextAction({
  today: { ...noPendingToday, timeline: [] },
  missingLog: false,
  projectBacklog: [],
  execution: projectNextStepExecution,
  todayLogPath: "02-日记/工作日志/20260611_工作日志_周四.md",
});

assert.equal(projectNextStepAction.tone, "todo");
assert.match(projectNextStepAction.title, /Kora：实现 Today execution model/);
assert.match(projectNextStepAction.reason, /焦点/);

const offFocusOnlyToday: TodayWorklog = {
  ...today,
  todos: [{ text: "AI漫剧：临时整理设定", done: false }],
};
const offFocusOnlyExecution = deriveTodayExecution(offFocusOnlyToday, portfolio, [], {
  ...focusCoverage,
  coveredCount: 0,
  focusProjects: focusCoverage.focusProjects.map(item => ({ ...item, covered: false })),
  offFocusProjects: ["AI漫剧"],
});
const offFocusAction = selectTodayNextAction({
  today: offFocusOnlyToday,
  missingLog: false,
  projectBacklog: [],
  execution: offFocusOnlyExecution,
  todayLogPath: "02-日记/工作日志/20260611_工作日志_周四.md",
});

assert.equal(offFocusAction.badge, "非焦点");
assert.equal(offFocusAction.title, "AI漫剧：临时整理设定");
assert.match(offFocusAction.reason, /非焦点/);

const portfolioWithoutFocusNextStep: PortfolioModel = {
  ...portfolio,
  projects: portfolio.projects.map(item => item.focusRole ? { ...item, nextStep: "" } : item),
};
const offFocusBacklogExecution = deriveTodayExecution(noPendingToday, portfolioWithoutFocusNextStep, [backlog[1]], {
  ...focusCoverage,
  offFocusProjects: [],
});
const offFocusBacklogAction = selectTodayNextAction({
  today: noPendingToday,
  missingLog: false,
  projectBacklog: [backlog[1]],
  execution: offFocusBacklogExecution,
  todayLogPath: "02-日记/工作日志/20260611_工作日志_周四.md",
});

assert.equal(offFocusBacklogAction.tone, "pool");
assert.equal(offFocusBacklogAction.badge, "非焦点");
assert.equal(offFocusBacklogAction.projectItem?.project, "AI漫剧");
