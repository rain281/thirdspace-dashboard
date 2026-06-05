# Today Work Metrics Dashboard Design

## 背景

`TODAY`、`TODAY'S TODOS`、`PROJECT POOL`、`时间线 / 产出` 都围绕今日工作，但现在存在信息重复：Todo 会同时出现在 `TODAY` 和 `TODAY'S TODOS`，项目候选任务也容易与未来的 `ToAdd` 概念重叠。用户已选择“执行 + 指标版”作为下一步方向。

## 目标

把今日工作页拆成清晰的四类职责：

1. `TODAY`：今日指标驾驶舱，不再完整复制 Todo 列表。
2. `TODAY'S TODOS`：今日执行清单，负责勾选完成、编辑、归档。
3. `PROJECT POOL`：项目候选池，负责把项目级任务拉入今天。
4. `时间线 / 产出`：今日事实流，负责展示已经发生的记录、产出、Agent 事件和 Git 提交。

## 推荐布局

`TODAY` 卡片保留在今日页核心位置，但内部从三块内容改成：

| 区域 | 内容 | 数据源 |
|------|------|--------|
| 今日重点 | `## 今日重点` 前 3 条 | 今日工作日志 |
| 今日指标 | 今日承诺、今日完成、今日产出、Git 提交、Agent 产出、涉及项目 | 今日 Todo、timeline |
| 当前焦点 | 第一个未完成 Todo，或空状态提示 | `## 今日Todo` |
| 阻塞提示 | 命中 `blocked` / `等待` / `卡住` 的 Todo 或记录数量 | Todo + timeline |

`TODAY` 不再展示完整 Todo 列表；完整列表只在 `TODAY'S TODOS` 出现。

## 指标定义

| 指标 | 计算方式 | 显示示例 |
|------|----------|----------|
| 今日承诺 | 今日 Todo 总数 | `7 total` |
| 待完成 | 未完成 Todo 数 | `3 pending` |
| 今日完成 | 已完成 Todo 数 | `4 done` |
| 今日产出 | `timeline.kind === "output"` 数量 | `5 outputs` |
| Git 提交 | `timeline.kind === "git"` 数量 | `2 commits` |
| Agent 产出 | `timeline.kind === "agent"` 数量 | `4 agent` |
| 涉及项目 | 从 Todo 前缀、timeline 标题/副标题中提取项目名并去重 | `3 projects` |
| 阻塞项 | 文本包含 `blocked`、`阻塞`、`等待`、`卡住` | `1 blocked` |

## 卡片边界

### TODAY

回答“今天状态如何？”  
只展示摘要和指标，点击可打开今日工作日志。

### TODAY'S TODOS

回答“今天承诺做什么，完成了吗？”  
支持勾选、编辑、完成归档。它是唯一的完整 Todo 列表。

### PROJECT POOL

回答“有哪些项目任务可以加入今天？”  
只展示还没进入今日执行清单的项目级候选任务，保留 `今日` 按钮。

### 时间线 / 产出

回答“今天实际发生了什么？”  
只展示已经发生的记录、产出、Agent 事件、Git 提交。未完成任务不进入这里。

## 验收标准

1. `TODAY` 不再完整复制 `TODAY'S TODOS`。
2. `TODAY'S TODOS` 仍是唯一完整 Todo 操作卡。
3. `PROJECT POOL` 不显示已进入今日 Todo 的任务。
4. `时间线 / 产出` 不显示未完成候选任务。
5. 今日页四块职责可以用一句话解释清楚：状态、执行、候选、事实。
