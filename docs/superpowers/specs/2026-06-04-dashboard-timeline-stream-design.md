# Dashboard Timeline Stream Design

## 目标

把 `时间线 / 产出` 从三段拼接改成统一事件流，让今天的记录、产出、Agent 产出和 Git 提交按真实时间展示，并支持按类型筛选。

## 已确认方向

1. 建立统一 `TimelineItem` 模型，覆盖 `record`、`output`、`agent`、`git`。
2. 所有条目按时间倒序排列；没有可靠时间的条目排在最后。
3. UI 提供 `全部 / 记录 / 产出 / Agent / Git` 筛选。
4. 点击条目优先打开具体目标文件；没有目标时回退到今日工作日志。
5. 产出条目显示清理后的标题、类型徽标和路径副标题，不再直接展示整行原始 Markdown。
6. 同源或跨源重复条目按稳定 key 去重，保留更完整的信息。
7. 优先合并 `.thirdspace/events/YYYYMMDD.ndjson` 和 `.thirdspace/git/commits.json` 的结构化 Git 数据，工作日志解析继续兜底。

## 数据流

1. `loadTodayWorklog()` 找到今日工作日志并解析原有 section。
2. `buildTimelineItems()` 把工作日志记录、今日产出、Agent 产出、Git 提交转成统一模型。
3. `loadStructuredTimelineItems()` 读取当天 `.thirdspace/events/YYYYMMDD.ndjson`，并从 `.thirdspace/git/commits.json` 补充当天 Git 历史。
4. `mergeTimelineItems()` 用稳定 key 去重，再按 `timestamp` 倒序排序。
5. `renderTodayWorklog()` 用统一列表渲染筛选器和条目。

## UI 行为

- `全部` 展示所有条目；其它筛选只展示对应 kind。
- `record` 和 `agent` 默认打开今日工作日志。
- `output` 优先打开解析出的 wiki link、Markdown link 或反引号路径。
- `git` 如果涉及单个文件且 vault 内存在该文件，则打开文件；否则打开今日工作日志。
- 每条目保留一到两行正文或路径副标题，避免把长段日志塞满卡片。

## 验收

- `7真实/7总数` 改进方向均落地。
- `npm run build` 通过。
- Rain 插件部署产物与 dashboard 构建产物一致。
- Rain 今日工作日志记录本次 Agent 产出与提交结果。
