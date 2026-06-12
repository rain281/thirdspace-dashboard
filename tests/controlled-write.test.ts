import assert from "node:assert/strict";
import {
  applyControlledWritePreview,
  createFocusYamlPreview,
  createManagedSectionPreview,
  createOperationPreview,
} from "../src/data/controlled-write";

const weeklyPlan = [
  "# 2026-W24 周计划",
  "",
  "## 本周 Focus",
  "",
  "- Kora",
  "",
  "## 复盘",
  "",
  "人类保留内容。",
  "",
  "<!-- thirdspace-dashboard:start weekly-review -->",
  "旧复盘",
  "<!-- thirdspace-dashboard:end weekly-review -->",
  "",
  "## 下周计划",
  "",
  "- 继续推进",
  "",
].join("\n");

const reviewPreview = createManagedSectionPreview({
  path: "02-日记/周计划/2026-W24_周计划.md",
  title: "写入周复盘",
  section: "复盘",
  marker: "weekly-review",
  content: ["### Dashboard 周复盘", "", "- Focus 推进：Kora 有产出。"].join("\n"),
  existingContent: weeklyPlan,
  warnings: ["只会替换 Dashboard managed block，不覆盖手写复盘。"],
});

assert.equal(reviewPreview.path, "02-日记/周计划/2026-W24_周计划.md");
assert.equal(reviewPreview.title, "写入周复盘");
assert.equal(reviewPreview.summary, "更新 ## 复盘 中的 Dashboard managed block");
assert.deepEqual(reviewPreview.warnings, ["只会替换 Dashboard managed block，不覆盖手写复盘。"]);
assert.match(reviewPreview.after, /人类保留内容。/);
assert.match(reviewPreview.after, /### Dashboard 周复盘/);
assert.doesNotMatch(reviewPreview.after, /旧复盘/);
assert.match(reviewPreview.diff, /-旧复盘/);
assert.match(reviewPreview.diff, /\+### Dashboard 周复盘/);
assert.match(reviewPreview.writeContent, /<!-- thirdspace-dashboard:start weekly-review -->/);
assert.match(reviewPreview.writeContent, /<!-- thirdspace-dashboard:end weekly-review -->/);

const appliedReview = applyControlledWritePreview(reviewPreview, weeklyPlan);
assert.equal(appliedReview, reviewPreview.after);
assert.equal(applyControlledWritePreview(reviewPreview, appliedReview), appliedReview);

const createdSection = createManagedSectionPreview({
  path: "04-项目/产品系统/Kora/项目状态.md",
  title: "更新下一步",
  section: "下一步",
  marker: "project-next-step",
  content: "- [ ] 建立学习收件箱。",
  existingContent: "# Kora 项目状态\n\n## 目标\n\n学习系统。",
});

assert.match(createdSection.after, /## 目标\n\n学习系统。\n\n## 下一步\n\n<!-- thirdspace-dashboard:start project-next-step -->/);
assert.match(createdSection.summary, /创建 ## 下一步/);

const untouched = createManagedSectionPreview({
  path: "project.md",
  title: "新增风险",
  section: "风险与阻塞",
  marker: "project-risk",
  content: "- [ ] API 权限未确认。",
  existingContent: "# Project\n\n## 下一步\n\n保留下一步。\n\n## 风险与阻塞\n\n已有风险。\n\n## 待决策\n\n保留决策。",
});

assert.match(untouched.after, /## 下一步\n\n保留下一步\。/);
assert.match(untouched.after, /## 待决策\n\n保留决策。/);
assert.match(untouched.after, /已有风险。/);
assert.match(untouched.after, /API 权限未确认。/);

const yamlPreview = createFocusYamlPreview({
  path: ".thirdspace/focus-week.yaml",
  title: "确认下周 Focus",
  yaml: [
    'week: "2026-W25"',
    'confirmation_status: "confirmed"',
    "focus_limit: 3",
    "focus_projects:",
    '  - id: "kora"',
    '    role: "main"',
    '    reason: "主项目"',
    "off_focus_policy: allow_today_with_reason",
    "off_focus_events: []",
  ].join("\n"),
  existingContent: "",
  warnings: ["Focus 上限为 3；不会修改 archived 项目。"],
});

assert.equal(yamlPreview.summary, "写入结构化 YAML 状态文件");
assert.match(yamlPreview.after, /confirmation_status: "confirmed"/);
assert.deepEqual(yamlPreview.warnings, ["Focus 上限为 3；不会修改 archived 项目。"]);

const operationPreview = createOperationPreview({
  path: "Dashboard controlled operation",
  title: "纳入项目候选",
  summary: "确认后才会更新项目索引、项目首页和发现队列。",
  content: "- 项目：Kora\n- 操作：纳入",
  warnings: ["这是多文件操作，确认前不会写入 vault。"],
});

assert.equal(operationPreview.path, "Dashboard controlled operation");
assert.equal(operationPreview.title, "纳入项目候选");
assert.match(operationPreview.writeContent, /项目：Kora/);
assert.match(operationPreview.diff, /确认后才会更新/);
assert.deepEqual(operationPreview.warnings, ["这是多文件操作，确认前不会写入 vault。"]);
