import assert from "node:assert/strict";
import {
  currentIsoWeek,
  deriveManagedProjects,
  derivePortfolioSummary,
  parseFocusWeekYaml,
  parseProjectStatusMarkdown,
  STANDARD_PROJECT_STATUS_SECTIONS,
  type ProjectIndexLike,
} from "../src/data/project-management";

const standardMarkdown = `---
type: "project-status"
project: "kora"
priority: "P0"
stage: "构建"
lifecycle: "active"
updated: "2026-06-05"
---

# Kora 项目状态

## 项目摘要
Kora 是本地优先知识成长 App。

## 目标
- 构建一个可以管理 Rain vault 的本地工作台。

## 成功标准
- 用户能从 Dashboard 判断今日应该推进什么。

## 当前阶段
构建

## 当前里程碑
M2-A Vault scanner

## 本周 Focus
主项目

## 下一步
- [ ] 完成 Portfolio 只读版

## 风险与阻塞
- [ ] 状态模板尚未统一

## 待决策
- [ ] Portfolio 首屏密度

## 决策记录
- 2026-06-05 采用本周 Focus

## 交付门禁
- [ ] npm run build

## 最近状态
2026-06-05 更新设计文档

## 复盘记录
- 本周验证 Portfolio 方向

## 关联资源
- [[Kora-Codex上下文]]

## 历史备注
旧内容保留在这里
`;

const parsed = parseProjectStatusMarkdown(standardMarkdown, "04-项目/产品系统/Kora/Kora项目状态.md");

assert.equal(parsed.projectId, "kora");
assert.equal(parsed.priority, "P0");
assert.equal(parsed.stage, "构建");
assert.equal(parsed.lifecycle, "active");
assert.equal(parsed.updated, "2026-06-05");
assert.equal(parsed.sections.goal.includes("本地工作台"), true);
assert.equal(parsed.sections.nextStep.includes("完成 Portfolio 只读版"), true);
assert.deepEqual(parsed.missingSections, []);

const missing = parseProjectStatusMarkdown("# Legacy\n\n## 下一步\n- [ ] old", "legacy.md");
assert.equal(missing.projectId, "");
assert.equal(missing.priority, "P2");
assert.equal(missing.stage, "孵化");
assert.equal(missing.lifecycle, "watch");
assert.ok(missing.missingSections.includes("目标"));
assert.equal(STANDARD_PROJECT_STATUS_SECTIONS.includes("交付门禁"), true);

const focus = parseFocusWeekYaml(`week: "2026-W23"
focus_limit: 3
focus_projects:
  - id: "kora"
    role: "main"
    reason: "P0 · 当前主产品"
  - id: "pilot"
    role: "support"
    reason: "发布门禁未关闭"
  - id: "comic-drama"
    role: "maintenance"
    reason: "保持管线连续性"
off_focus_policy: "allow_today_with_reason"
off_focus_events:
  - date: "2026-06-05"
    project_id: "aidv"
    reason: "临时机会"
    target: "today"
`);

assert.equal(focus.week, "2026-W23");
assert.equal(focus.focusLimit, 3);
assert.equal(focus.focusProjects[0].id, "kora");
assert.equal(focus.focusProjects[0].role, "main");
assert.equal(focus.offFocusEvents[0].projectId, "aidv");
assert.equal(focus.offFocusEvents[0].reason, "临时机会");

const fallbackFocus = parseFocusWeekYaml("");
assert.equal(fallbackFocus.focusLimit, 3);
assert.equal(fallbackFocus.focusProjects.length, 0);
assert.match(currentIsoWeek(new Date("2026-06-05T12:00:00+08:00")), /^2026-W23$/);

const indexProjects: ProjectIndexLike[] = [
  {
    id: "kora",
    name: "Kora",
    category: "产品系统",
    lifecycle: "active",
    workspace: "04-项目/产品系统/Kora",
    repo_path: "/Volumes/资料/projects/Kora",
    project_home: "04-项目/产品系统/Kora/首页.md",
    status_note: "04-项目/产品系统/Kora/Kora项目状态.md",
    codex_context: "04-项目/产品系统/Kora/Kora-Codex上下文.md",
  },
  {
    id: "pilot",
    name: "Pilot",
    category: "产品系统",
    lifecycle: "watch",
    workspace: "04-项目/产品系统/Pilot",
    status_note: "04-项目/产品系统/Pilot/Pilot项目状态.md",
  },
  {
    id: "xiaohuanzi",
    name: "小桓子",
    category: "产品系统",
    lifecycle: "archived",
    workspace: "99-归档/完结项目/小桓子",
    status_note: "99-归档/完结项目/小桓子/小桓子项目状态.md",
  },
];

const staleMarkdown = standardMarkdown.replace('updated: "2026-06-05"', 'updated: "2026-05-20"');
const noNextStepMarkdown = standardMarkdown
  .replace('project: "kora"', 'project: "pilot"')
  .replace('priority: "P0"', 'priority: "P1"')
  .replace('stage: "构建"', 'stage: "交付"')
  .replace('updated: "2026-06-05"', 'updated: "2026-06-01"')
  .replace("- [ ] 完成 Portfolio 只读版", "");

const managed = deriveManagedProjects({
  projects: indexProjects,
  statuses: new Map([
    ["kora", parseProjectStatusMarkdown(staleMarkdown, "kora.md")],
    ["pilot", parseProjectStatusMarkdown(noNextStepMarkdown, "pilot.md")],
  ]),
  focusWeek: focus,
  now: new Date("2026-06-05T12:00:00+08:00"),
});

assert.equal(managed.length, 2);
assert.equal(managed[0].id, "kora");
assert.equal(managed[0].focusRole, "main");
assert.equal(managed[0].health.status, "风险");
assert.ok(managed[0].health.reasons.includes("状态超过 7 天未更新"));
assert.equal(managed[1].id, "pilot");
assert.equal(managed[1].focusRole, "support");
assert.ok(managed[1].health.reasons.includes("缺下一步"));

const summary = derivePortfolioSummary(managed, focus);
assert.equal(summary.totalManaged, 2);
assert.equal(summary.focusUsed, 2);
assert.equal(summary.riskCount, 1);
assert.equal(summary.noNextStepCount, 1);
assert.equal(summary.staleCount, 1);

const statusArchivedMarkdown = standardMarkdown
  .replace('project: "kora"', 'project: "archived-in-status"')
  .replace('lifecycle: "active"', 'lifecycle: "archived"');
const managedWithoutStatusArchived = deriveManagedProjects({
  projects: [
    {
      id: "archived-in-status",
      name: "Archived In Status",
      lifecycle: "active",
      workspace: "04-项目/产品系统/Archived In Status",
      status_note: "04-项目/产品系统/Archived In Status/项目状态.md",
    },
  ],
  statuses: new Map([
    ["archived-in-status", parseProjectStatusMarkdown(statusArchivedMarkdown, "archived-in-status.md")],
  ]),
  focusWeek: focus,
  now: new Date("2026-06-05T12:00:00+08:00"),
});

assert.equal(managedWithoutStatusArchived.length, 0);

const blockedPendingDecisionMarkdown = standardMarkdown
  .replace('project: "kora"', 'project: "blocked-decision"')
  .replace('priority: "P0"', 'priority: "P1"')
  .replace("## 风险与阻塞\n- [ ] 状态模板尚未统一", "## 风险与阻塞\n")
  .replace("## 待决策\n- [ ] Portfolio 首屏密度", "## 待决策\n- [ ] 等待确认 Portfolio 首屏密度");
const blockedDecisionProject = deriveManagedProjects({
  projects: [
    {
      id: "blocked-decision",
      name: "Blocked Decision",
      lifecycle: "active",
      workspace: "04-项目/产品系统/Blocked Decision",
      status_note: "04-项目/产品系统/Blocked Decision/项目状态.md",
    },
  ],
  statuses: new Map([
    ["blocked-decision", parseProjectStatusMarkdown(blockedPendingDecisionMarkdown, "blocked-decision.md")],
  ]),
  focusWeek: focus,
  now: new Date("2026-06-05T12:00:00+08:00"),
})[0];

assert.equal(blockedDecisionProject.health.status, "风险");
assert.ok(blockedDecisionProject.health.reasons.includes("存在待决策"));
