import assert from "node:assert/strict";
import {
  parseProjectStatusMarkdown,
  STANDARD_PROJECT_STATUS_SECTIONS,
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
