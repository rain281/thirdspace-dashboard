# 单人创始人项目管理系统设计

Status: draft for user review
Date: 2026-06-05
Scope: design document only; no app code, vault project notes, or plugin deployment files are modified in this step

## 摘要

ThirdSpace Dashboard 的项目能力要从“知识库活动面板”升级为“单人创始人项目管理系统”。新系统不追求团队协作软件的完整流程，而是服务一个核心场景：一个人同时推进多个产品、代码、内容和研究项目时，能够清楚决定本周聚焦什么、今天交付什么、哪个项目有风险、哪个项目应该暂停或降级。

这份设计依据三类材料：现有 ThirdSpace Dashboard 技术文档和源码、Rain vault 的项目索引与项目状态模板、以及本次对话中确认的产品决策。

## 依据

### 技术文档和源码依据

| 依据 | 结论 |
|---|---|
| `README.md` 当前功能表 | Dashboard 现有核心卡片是统计、活动热力图、工作区、今日、Todo、Quick、Products、Recent。项目管理能力仍偏数据展示。 |
| `README.md` 数据源映射 | `PRODUCTS` 依赖 `04-项目/product-status.md`，这与 Rain 当前 `.thirdspace/project-index.yaml` 的项目索引方向不一致。 |
| `src/view.ts` `renderProjectsPage()` | 当前项目页由 `ACTIVITY`、`WORKSPACES`、`RECENT`、`MATERIALS`、`PRODUCTS` 组成，更像系统维护页，不像 PM 项目组合页。 |
| `src/data/vault-reader.ts` | 现有 `ProjectIndexEntry` 已包含 `id`、`name`、`workspace`、`lifecycle`、`repo_path`、`category`、`project_home`、`status_note`、`codex_context`，可作为新项目管理系统的基础索引。 |
| `package.json` | 插件使用 TypeScript + esbuild，验证和交付路径是 `npm run build` 后同步 `main.js` / `main.css` 到 Rain vault 插件目录。 |

### Rain vault 依据

| 依据 | 结论 |
|---|---|
| `.thirdspace/project-index.yaml` | 当前真实项目索引包括 Kora、Pilot、AI漫剧、comic-drama-pipeline、AIDV、小桓子等，并标记 `active`、`watch`、`archived`。 |
| `05-资源/模板/项目状态模板.md` | 现有模板偏项目资料入口、版本进度、知识库和命令速查，缺少目标、成功标准、风险、决策、交付门禁、健康度等 PM 字段。 |
| active / watch 项目状态笔记 | 这些笔记是后续 PM 系统的核心真相源；archived 项目保持历史资料，不进入迁移范围。 |

### 本次对话确认项

| 主题 | 决策 |
|---|---|
| 工作流 | 单人创始人 / 独立开发 |
| WIP 上限 | 本周最多 3 个 Focus 项目 |
| Focus 选择 | 系统推荐，但必须由用户确认 |
| Focus 周期 | 本周 Focus |
| Focus 存储 | `.thirdspace/focus-week.yaml` + 周计划 Markdown |
| Focus 角色 | 主项目 / 副项目 / 维护项目 |
| 约束强度 | 中等约束，允许插队但必须记录原因 |
| 写入方式 | 受控写入 |
| 项目状态模板 | active / watch 项目全部统一标准模板 |
| 归档项目 | 不迁移、不重写 |
| 迁移方式 | 严格重组，无法归类内容进入 `## 历史备注` |
| 项目阶段 | 孵化 / 聚焦 / 构建 / 交付 / 增长 / 维护 / 暂停 |
| 项目优先级 | P0 / P1 / P2 / P3 |
| 项目健康度 | 总状态 + 原因标签 |
| 状态过旧阈值 | 7 天 |

## 产品定位

新系统不是团队 Jira、Notion 项目库或完整文档编辑器。它是一个本地优先的个人项目操作台，帮助用户回答五个问题：

1. 本周最多应该聚焦哪三个项目？
2. 今天真正要交付什么结果？
3. 哪些项目缺下一步、缺决策、缺交付门禁或状态过旧？
4. 哪些 off-focus 插队正在稀释注意力？
5. 每个项目当前目标、阶段、风险和下一步是否足够清楚，能否交给 Codex/GPT 继续工作？

## 非目标

- 不做团队成员、权限、评论、多人协作。
- 不做完整项目编辑器，不替代 Obsidian Markdown。
- 不自动修改代码仓库。
- 不自动执行项目命令。
- 不自动归档项目。
- 不迁移 archived 项目。
- 不长期兼容旧项目状态笔记格式。

## 核心概念

### 本周 Focus

本周 Focus 是系统的注意力预算。最多 3 个项目，分成三个角色：

| 角色 | 数量 | 系统期待 |
|---|---:|---|
| 主项目 | 1 | 本周主要推进对象，每天应有明确结果，缺下一步时最高优先级报警。 |
| 副项目 | 1 | 本周有限推进对象，至少有 1-2 次小交付或明确进展。 |
| 维护项目 | 1 | 保温、小修、风险处理，不允许吞掉主项目时间。 |

Focus 不等于 `lifecycle: active`。`active` 表示项目仍在管理范围内，Focus 表示本周愿意投入注意力。

### 中等约束

系统不强行阻止用户操作，但会记录注意力切换：

| 场景 | 行为 |
|---|---|
| 第 4 个项目进入 Focus | 允许继续，但必须选择原因，并提示是否替换现有 Focus。 |
| 非 Focus 项目加入 Today | 允许加入，但标记 `off-focus` 并记录原因。 |
| 维护项目出现大任务 | 允许记录，但提示维护项目正在吞噬主项目时间。 |
| 本周多次 off-focus | Review 页汇总，并提示下周是否调整 Focus。 |

off-focus 原因第一版使用固定选项：紧急修复、临时机会、外部承诺、只是记录不推进、需要重新规划 Focus。

### 受控写入

Dashboard 可以写入结构化、小范围、高价值字段。Markdown 仍是真实来源，Dashboard 不做自由大段编辑。

允许写入：

| 动作 | 写入位置 |
|---|---|
| 设置本周 Focus | `.thirdspace/focus-week.yaml` |
| 生成周计划镜像 | `02-日记/周计划/YYYY-WW_周计划.md` |
| 更新下一步 | 项目状态笔记 `## 下一步` |
| 新增风险 | 项目状态笔记 `## 风险与阻塞` |
| 标记风险解除 | 项目状态笔记 `## 风险与阻塞` |
| 新增决策待办 | 项目状态笔记 `## 待决策` |
| 标记已决策 | 项目状态笔记 `## 决策记录` |
| 加入 Today | 今日工作日志 `## 今日Todo` |
| 记录 off-focus | 今日工作日志或周计划 `## 插队记录` |
| 周复盘 | 周计划 `## 复盘` |

禁止写入：

- 项目正文长文档。
- 架构设计文档。
- 研究笔记。
- 任意 Markdown 区块。
- 代码仓库文件。
- API key、token、密钥、cookie 等敏感数据。

## 标准项目状态模板

active / watch 项目状态笔记必须统一为以下 section。Dashboard 只解析这些标准 section；缺少 section 视为项目状态不合格。

```markdown
---
type: "project-status"
project: "<project-id>"
priority: "P0 | P1 | P2 | P3"
stage: "孵化 | 聚焦 | 构建 | 交付 | 增长 | 维护 | 暂停"
lifecycle: "active | watch"
updated: "YYYY-MM-DD"
source: "manual"
---

# <项目名> 项目状态

## 项目摘要

## 目标

## 成功标准

## 当前阶段

## 当前里程碑

## 本周 Focus

## 下一步

## 风险与阻塞

## 待决策

## 决策记录

## 交付门禁

## 最近状态

## 复盘记录

## 关联资源

## 历史备注
```

### 阶段定义

| 阶段 | 含义 |
|---|---|
| 孵化 | 想法、研究、可能性，还没承诺投入。 |
| 聚焦 | 已决定进入本周或近期重点，需要明确目标和成功标准。 |
| 构建 | 正在做核心功能、内容、资产或系统能力。 |
| 交付 | 接近可验收，需要测试、发布、文档和收尾。 |
| 增长 | 已有可用结果，关注传播、复用、迭代和用户反馈。 |
| 维护 | 保持可用，小修、小更新、风险处理。 |
| 暂停 | 主动停止推进，等待条件或重新评估。 |

### 优先级定义

| 优先级 | 含义 | 系统行为 |
|---|---|---|
| P0 | 当前最关键项目，强战略或交付价值。 | 强烈推荐为主项目候选；缺下一步或状态过旧时进入风险。 |
| P1 | 重要项目，近期值得推进。 | 可推荐为副项目候选。 |
| P2 | 有价值但不紧急。 | 默认 Watch，除非有明确机会。 |
| P3 | 暂低优先级。 | 不推荐 Focus，只做维护或归档提醒。 |

## 数据模型

### Project

```text
Project
- id
- name
- category
- lifecycle
- priority
- stage
- workspace
- repo_path
- project_home
- status_note
- codex_context
- goal
- success_criteria
- milestone
- focus_role
- next_step
- risks[]
- decisions_pending[]
- decisions_done[]
- delivery_gates[]
- recent_status
- updated_at
- health_status
- health_reasons[]
- material_health
```

### FocusWeek

```yaml
week: "2026-W23"
focus_limit: 3
focus_projects:
  - id: "kora"
    role: "main"
    reason: "P0 · 当前主产品 · 本周要完成项目管理页设计"
  - id: "pilot"
    role: "support"
    reason: "发布门禁未关闭"
  - id: "comic-drama"
    role: "maintenance"
    reason: "保持内容管线连续性"
off_focus_policy: "allow_today_with_reason"
off_focus_events:
  - date: "2026-06-05"
    project_id: "aidv"
    reason: "临时机会"
    target: "today"
```

### 健康度

每个项目显示总状态和原因标签。

| 状态 | 触发条件 |
|---|---|
| 健康 | 有目标、有成功标准、有下一步、状态 7 天内更新、无未处理阻塞、阶段信息完整。 |
| 注意 | 状态过旧、缺成功标准、缺交付门禁、存在非关键风险、长期无产出。 |
| 风险 | P0 缺下一步、Focus 项目无本周结果、存在阻塞、交付阶段缺验收、待决策卡住。 |

状态过旧默认阈值是 7 天。Paused / archived 不参与普通过旧警报。

## 信息架构

### Today

Today 只回答：今天是否在推进正确项目，以及今天交付风险在哪里。

卡片：

| 卡片 | 作用 |
|---|---|
| Today Outcomes | 今天最多 3 个交付结果，不等同 Todo 列表。 |
| Focus Projects | 显示本周主 / 副 / 维护项目，以及今天是否覆盖。 |
| Next Action | 当前唯一下一步，沿用现有 Next Action 思路但优先考虑本周 Focus。 |
| Commitments at Risk | 今天承诺中可能完不成或影响交付的事项。 |
| Decision Needed | 今天需要拍板的事项。 |
| Today Todos | 今日执行清单，继续负责勾选、编辑、完成归档。 |
| Timeline / Outputs | 今日事实流，继续显示记录、产出、Agent、Git。 |

Today 不展示完整项目组合，不做项目健康全景。

### Portfolio

Portfolio 替代当前项目系统主界面，只回答：哪些项目健康，哪些危险，哪些需要本周管理动作。

卡片：

| 卡片 | 作用 |
|---|---|
| Portfolio Health | active / watch 数量、Focus 使用量、风险项目、状态过旧、缺下一步、缺交付门禁。 |
| Weekly Focus | 本周主 / 副 / 维护项目，显示目标、下一步、风险和本周状态。 |
| Focus Suggestions | 系统推荐可进入 Focus 的项目，用户确认后写入 FocusWeek。 |
| Priority Projects | P0 / P1 项目组合视图，避免活动量替代优先级。 |
| Risk & Decision Queue | 跨项目风险、阻塞、待决策，按严重程度排序。 |
| Stale Status | 超过 7 天未更新的 active/watch 项目。 |
| Delivery Gates | 交付阶段项目的测试、验收、文档、发布等门禁。 |

Activity、Recent、Materials、Project Discovery 不再占据 Portfolio 主视觉。

### Project Detail

Project Detail 是项目卡点击后的详情抽屉或独立页。

模块：

| 模块 | 作用 |
|---|---|
| Header | 项目名、优先级、阶段、生命周期、健康状态。 |
| Goal | 目标和成功标准。 |
| Milestone | 当前里程碑和交付门禁。 |
| Next Step | 下一步，可受控写入。 |
| Risks | 风险与阻塞，可新增或解除。 |
| Decisions | 待决策和决策记录。 |
| Backlog | 未完成事项摘要，可加入 Today。 |
| Recent Outputs | 最近产出、Agent 事件、Git 活动摘要。 |
| Context Readiness | Codex context、资料索引、项目首页、状态笔记是否存在。 |
| Quick Links | 打开首页、状态笔记、上下文、资料索引、仓库路径。 |

### Review

Review 用于每日或每周收束。第一版可先以周计划 Markdown 为主，不一定做完整 UI。

内容：

| 模块 | 作用 |
|---|---|
| Focus Review | 主 / 副 / 维护项目本周是否推进。 |
| Outcomes | 本周实际产出。 |
| Off-focus Review | 插队次数、原因、是否需要调整下周 Focus。 |
| Risks Closed / Open | 已解除和仍未解除风险。 |
| Decisions Made | 本周已决策事项。 |
| Next Week Proposal | 系统推荐下周 Focus。 |

### System

System 承接当前项目页里的维护信息。

内容：

| 模块 | 作用 |
|---|---|
| Activity | 全库活动、项目活动、Git 活动。 |
| Recent Files | 最近文件流。 |
| Materials | 项目资料索引健康和导入操作。 |
| Project Discovery | 新项目待确认。 |
| Project Onboarding | 项目接入状态。 |
| Data Health | project-index、focus-week、状态模板、周计划文件是否一致。 |

## 交互主线

```text
Portfolio 发现问题
  -> 打开 Project Detail 理解项目上下文
  -> 设置下一管理动作或加入 Today
  -> Today 执行并记录产出
  -> Review 汇总本周 Focus 表现
  -> 更新项目状态笔记和下周 Focus
```

## 迁移策略

迁移范围只包括 `.thirdspace/project-index.yaml` 中 active / watch 项目。archived 项目不动。

迁移原则：

1. 严格重组项目状态笔记到标准 section。
2. 能识别的内容归位到目标、成功标准、里程碑、下一步、风险、决策、交付门禁、关联资源等 section。
3. 无法可靠归类的内容进入 `## 历史备注`。
4. 不删除信息。
5. 每个迁移过的项目状态笔记保留迁移记录。
6. 迁移完成后，Dashboard 不长期兼容旧格式。

## 验收标准

1. active / watch 项目都有标准项目状态模板。
2. archived 项目没有被修改。
3. `.thirdspace/focus-week.yaml` 能表达本周主 / 副 / 维护项目。
4. Portfolio 能显示项目健康度和原因标签。
5. Today 能显示本周 Focus 与今日交付结果之间的关系。
6. 非 Focus 项目加入 Today 时记录 off-focus 原因。
7. Project Detail 能打开项目的状态笔记、首页、上下文、资料索引和仓库路径。
8. 受控写入只修改固定 section 和固定状态文件。
9. `npm run build` 通过，Rain 插件部署产物一致。

