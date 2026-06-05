# Next Action Card Design

## 背景

今日工作页已经拆出四个边界：`TODAY` 看状态指标，`TODAY'S TODOS` 做执行清单，`PROJECT POOL` 放项目候选任务，`时间线 / 产出` 展示事实流。剩余重复点是首行 `OVERVIEW` 仍展示全库统计，和 `TODAY` 指标驾驶舱的“状态概览”语义接近，也不能回答用户打开页面时最急的问题：现在下一步做什么。

外部工具参考后的产品判断：项目管理工具通常把收件箱/候选池、今日执行、事实记录和状态指标分开；首屏最稀缺的位置应该给“决策”，不是再放一组静态统计。

## 目标

把今日工作页首行 `OVERVIEW` 替换为 `NEXT ACTION`，让它只回答一个问题：**我现在下一步做什么？**

## 非目标

1. 不新增独立数据库、JSON 队列或 frontmatter 字段。
2. 不移动 `TODAY'S TODOS`、`PROJECT POOL`、`时间线 / 产出` 的职责。
3. 不把 `PROJECT POOL` 变成执行清单。
4. 不在本轮重排今日页网格。

## 卡片职责

| 卡片 | 回答的问题 | 数据类型 |
|------|------------|----------|
| `NEXT ACTION` | 我现在下一步做什么 | 推断出的唯一建议 |
| `TODAY` | 今天整体状态如何 | 指标、焦点、阻塞数量 |
| `TODAY'S TODOS` | 今天承诺做什么，完成了吗 | 可操作 Todo 列表 |
| `PROJECT POOL` | 哪些项目任务可以拉入今天 | 候选池 |
| `时间线 / 产出` | 今天实际发生了什么 | 已发生事实 |

## 推荐规则

按顺序命中第一条：

1. 今日工作日志缺失：推荐创建今日日志。
2. 存在阻塞文本：推荐打开今日日志处理阻塞。
3. 存在未完成今日 Todo：推荐第一个未完成 Todo。
4. 今日 Todo 为空且 Project Pool 有候选：推荐把第一条项目任务加入今日。
5. 今天已有时间线记录但无今日产出：推荐补写今日产出/总结。
6. 以上都不命中：推荐设定今日重点或从 Project Pool 拉一项。

阻塞文本沿用现有规则：`blocked`、`阻塞`、`等待`、`卡住`。

## 界面结构

`NEXT ACTION` 保持在原 `overview` 网格区域，避免影响整体布局。

内容由三层组成：

1. 状态胶囊：`阻塞`、`今日Todo`、`项目池`、`总结`、`启动`。
2. 主行动文本：一条可执行建议，不展示多条任务列表。
3. 原因与动作按钮：简短说明为什么推荐它，并提供 `打开`、`加入今日`、`写总结` 或 `创建`。

风险提示最多 3 个：待办过多、无 Git 提交、无产出、存在阻塞。风险提示只做提示，不替代主行动。

## 交互

| 命中类型 | 主按钮 | 行为 |
|----------|--------|------|
| 缺今日日志 | `创建` | 调用 `openTodayLog()`，沿用现有创建逻辑 |
| 阻塞 / Todo / 总结 | `打开` 或 `写总结` | 打开今日工作日志 |
| 项目池候选 | `加入今日` | 调用 `promoteProjectBacklogItemToToday()` 后刷新页面 |
| 空状态 | `打开` | 打开今日工作日志 |

`NEXT ACTION` 不提供勾选完成，避免和 `TODAY'S TODOS` 重复。

## 数据流

`renderTodayPage()` 已经拥有 `todayWorklog`、`todos`、`projectBacklog`。新增视图层 helper：

- `calculateNextAction(today, missingLog, projectBacklog)`
- `blockedTextsFromToday(today)`
- `todayHasOutput(today)`
- `todayHasGit(today)`

其中 `today` 使用 `todayWorklog ?? emptyTodayWorklog()`，不增加数据读取成本。

## 验收标准

1. 今日页不再显示 `OVERVIEW` 文案。
2. 首行左侧显示 `NEXT ACTION`，且只推荐 1真实/1总数主行动。
3. 有未完成 Todo 时，推荐第一条未完成 Todo。
4. 今日 Todo 为空且 Project Pool 有候选时，推荐 `加入今日`，点击后候选进入 `TODAY'S TODOS`。
5. 有阻塞文本时，阻塞推荐优先于普通 Todo。
6. `TODAY`、`TODAY'S TODOS`、`PROJECT POOL`、`时间线 / 产出` 原职责不变。
7. `npm run build` 1真实/1总数通过，Rain 插件部署文件 2真实/2总数一致。
