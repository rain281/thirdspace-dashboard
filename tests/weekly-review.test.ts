import assert from "node:assert/strict";
import { deriveWeeklyReview, type WeeklyWorklogSnapshot } from "../src/data/weekly-review";
import type { PortfolioModel } from "../src/data/project-management";

const portfolio: PortfolioModel = {
  focusWeek: {
    week: "2026-W24",
    confirmationStatus: "confirmed",
    focusLimit: 3,
    focusProjects: [
      { id: "kora", role: "main", reason: "主项目推进" },
      { id: "pilot", role: "support", reason: "副项目收口" },
      { id: "aidv", role: "maintenance", reason: "维护观察" },
    ],
    offFocusPolicy: "allow_today_with_reason",
    offFocusEvents: [
      { date: "2026-06-11", projectId: "comic-drama", reason: "临时机会", target: "today" },
    ],
  },
  projects: [
    {
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
      successCriteria: "判断今日推进事项",
      milestone: "M2",
      nextStep: "- [ ] 完成 Review 页",
      risks: "- [ ] 发布门禁未关闭",
      pendingDecisions: "",
      deliveryGates: "- [ ] npm run build",
      recentStatus: "正在做 Review",
      updated: "2026-06-12",
      focusRole: "main",
      focusReason: "主项目推进",
      health: { status: "风险", reasons: ["存在未处理风险"] },
    },
    {
      id: "pilot",
      name: "Pilot",
      category: "产品系统",
      lifecycle: "active",
      priority: "P1",
      stage: "构建",
      workspace: "04-项目/产品系统/Pilot",
      repoPath: "/Volumes/资料/projects/Pilot",
      projectHome: "",
      statusNote: "04-项目/产品系统/Pilot/Pilot项目状态.md",
      codexContext: "",
      goal: "邮件集成",
      successCriteria: "能生成草稿",
      milestone: "Mail.app",
      nextStep: "- [ ] 确认权限",
      risks: "",
      pendingDecisions: "- [ ] 是否先做 Mail.app 权限",
      deliveryGates: "",
      recentStatus: "等待权限",
      updated: "2026-06-12",
      focusRole: "support",
      focusReason: "副项目收口",
      health: { status: "注意", reasons: ["存在待决策"] },
    },
    {
      id: "aidv",
      name: "AIDV",
      category: "研究验证",
      lifecycle: "watch",
      priority: "P2",
      stage: "维护",
      workspace: "04-项目/研究验证/AIDV",
      repoPath: "",
      projectHome: "",
      statusNote: "04-项目/研究验证/AIDV/AIDV项目状态.md",
      codexContext: "",
      goal: "保持观察",
      successCriteria: "不丢上下文",
      milestone: "状态整理",
      nextStep: "- [ ] 补状态页",
      risks: "",
      pendingDecisions: "",
      deliveryGates: "",
      recentStatus: "低频维护",
      updated: "2026-06-10",
      focusRole: "maintenance",
      focusReason: "维护观察",
      health: { status: "健康", reasons: [] },
    },
    {
      id: "comic-drama",
      name: "AI漫剧",
      category: "内容创作",
      lifecycle: "active",
      priority: "P2",
      stage: "孵化",
      workspace: "04-项目/内容创作/AI漫剧",
      repoPath: "",
      projectHome: "",
      statusNote: "",
      codexContext: "",
      goal: "验证内容管线",
      successCriteria: "完成样片",
      milestone: "",
      nextStep: "",
      risks: "",
      pendingDecisions: "",
      deliveryGates: "",
      recentStatus: "",
      updated: "2026-06-09",
      focusRole: null,
      focusReason: "",
      health: { status: "注意", reasons: ["缺下一步"] },
    },
  ],
  summary: {
    totalManaged: 4,
    activeCount: 3,
    watchCount: 1,
    focusLimit: 3,
    focusUsed: 3,
    riskCount: 1,
    attentionCount: 2,
    staleCount: 0,
    noNextStepCount: 1,
    deliveryGateGapCount: 0,
  },
};

const worklogs: WeeklyWorklogSnapshot[] = [
  {
    date: "2026-06-11",
    path: "02-日记/工作日志/20260611_工作日志_周四.md",
    worklog: {
      highlights: ["完成 Kora Portfolio"],
      todos: [{ text: "Kora：完成 Review 页", done: false }],
      entries: [],
      outputs: [
        { title: "完成 Kora Portfolio", raw: "- Kora：完成 Portfolio ✅ 2026-06-11", badge: "记录" },
        { title: "Pilot 权限方案", raw: "- Pilot：权限方案", badge: "记录" },
      ],
      events: [],
      timeline: [
        {
          id: "output:kora",
          kind: "output",
          time: "10:00",
          timestamp: new Date("2026-06-11T10:00:00+08:00").getTime(),
          title: "Kora：完成 Portfolio",
          body: [],
          raw: "Kora：完成 Portfolio",
          sourcePath: "02-日记/工作日志/20260611_工作日志_周四.md",
          badge: "记录",
        },
        {
          id: "output:pilot",
          kind: "output",
          time: "11:00",
          timestamp: new Date("2026-06-11T11:00:00+08:00").getTime(),
          title: "Pilot：权限方案",
          body: [],
          raw: "Pilot：权限方案",
          sourcePath: "02-日记/工作日志/20260611_工作日志_周四.md",
          badge: "记录",
        },
      ],
    },
  },
  {
    date: "2026-06-12",
    path: "02-日记/工作日志/20260612_工作日志_周五.md",
    worklog: {
      highlights: ["启动 Review"],
      todos: [{ text: "AI漫剧：临时确认 watch", done: false }],
      entries: [],
      outputs: [
        { title: "Review 页面计划", raw: "- Review 页面计划", badge: "记录" },
      ],
      events: [],
      timeline: [
        {
          id: "output:review",
          kind: "output",
          time: "09:00",
          timestamp: new Date("2026-06-12T09:00:00+08:00").getTime(),
          title: "ThirdSpace Dashboard：Review 页面计划",
          body: [],
          raw: "ThirdSpace Dashboard：Review 页面计划",
          sourcePath: "02-日记/工作日志/20260612_工作日志_周五.md",
          badge: "记录",
        },
      ],
    },
  },
];

const review = deriveWeeklyReview(portfolio, worklogs);

assert.equal(review.week, "2026-W24");
assert.equal(review.focusItems.length, 3);
assert.deepEqual(review.focusItems.map(item => [item.name, item.role, item.outcomeCount, item.hasProgress]), [
  ["Kora", "main", 1, true],
  ["Pilot", "support", 1, true],
  ["AIDV", "maintenance", 0, false],
]);
assert.equal(review.outcomes.length, 3);
assert.equal(review.offFocus.count, 1);
assert.equal(review.offFocus.events[0].projectName, "AI漫剧");
assert.match(review.risks.open[0].text, /发布门禁未关闭/);
assert.match(review.decisions.pending[0].text, /Mail\.app 权限/);
assert.match(review.nextWeekProposal.summary, /继续主项目/);
assert.ok(review.nextWeekProposal.items.some(item => item.projectName === "AIDV" && /暂停或降级/.test(item.reason)));
