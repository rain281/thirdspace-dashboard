# 单人创始人项目管理系统路线图

Status: draft for user review
Date: 2026-06-05
Scope: roadmap only; no app code, vault project notes, or plugin deployment files are modified in this step

## 摘要

这条路线图把 ThirdSpace Dashboard 从当前的活动/资料仪表盘，逐步升级成单人创始人项目管理系统。路线图不凭空设计，依据当前插件文档、源码结构、Rain vault 项目索引、现有项目状态模板，以及本次对话中确认的产品规则。

目标不是一次性做完整复杂软件，而是按依赖顺序推进：先统一数据契约，再迁移项目状态，再建立本周 Focus，最后重做 Portfolio、Today、Project Detail、Review 和 System。

## 路线图依据

| 类型 | 依据 | 对路线图的影响 |
|---|---|---|
| 当前 UI | `README.md` 显示当前项目相关能力是 `PRODUCTS`、`RECENT`、`ACTIVITY`、`MATERIALS` 等 | 当前项目页需要从数据展示转向 PM 决策。 |
| 当前源码 | `src/view.ts` 的 `renderProjectsPage()` 已经有项目页框架 | 可以在现有 Obsidian ItemView 内渐进重构，不需要换技术栈。 |
| 当前数据 | `.thirdspace/project-index.yaml` 已有项目 id、名称、仓库、类别、生命周期、状态笔记、上下文路径 | 新系统应以 project-index 为项目入口，而不是继续依赖 `product-status.md`。 |
| 当前模板 | `05-资源/模板/项目状态模板.md` 缺 PM 管理字段 | 必须先标准化项目状态模板，否则 Portfolio 健康度无法可靠计算。 |
| 构建部署 | `npm run build` 生成 `main.js/main.css`，再部署到 Rain vault 插件目录 | 每阶段必须包含构建验证和部署一致性验证。 |
| 对话确认 | 单人创始人、本周 Focus、3 项上限、主/副/维护、中等约束、受控写入 | 路线图优先做注意力管理和项目健康，而不是团队协作。 |

## 总体阶段

```text
Phase 0 规格冻结
Phase 1 数据契约
Phase 2 项目状态迁移
Phase 3 本周 Focus
Phase 4 Portfolio
Phase 5 Project Detail
Phase 6 Today 升级
Phase 7 Review / System 分离
Phase 8 验证、部署、复盘
```

## Phase 0：规格冻结

目标：把设计和路线图确认下来，避免后续实现边做边扩散。

交付物：

- `2026-06-05-founder-project-management-system-design.md`
- `2026-06-05-founder-project-management-roadmap.md`

验收标准：

- 文档明确标注技术依据。
- 文档明确标注对话确认项。
- 范围明确排除 archived 项目、团队协作、完整编辑器、代码仓库自动修改。

风险：

- 规格太大导致后续实现难以切分。

控制方式：

- 每个 Phase 必须能单独验证，不要求一次性上线全部能力。

## Phase 1：数据契约

目标：定义新项目管理系统依赖的稳定数据结构。

工作项：

1. 定义标准项目状态模板。
2. 定义 `.thirdspace/focus-week.yaml` 格式。
3. 定义周计划 Markdown 格式。
4. 定义项目健康度计算规则。
5. 定义受控写入 section 边界。

主要文件：

- `docs/superpowers/specs/2026-06-05-founder-project-management-system-design.md`
- Rain vault `05-资源/模板/项目状态模板.md`
- Rain vault `.thirdspace/focus-week.yaml`
- Rain vault `02-日记/周计划/YYYY-WW_周计划.md`

验收标准：

- 模板包含：项目摘要、目标、成功标准、当前阶段、当前里程碑、本周 Focus、下一步、风险与阻塞、待决策、决策记录、交付门禁、最近状态、复盘记录、关联资源、历史备注。
- FocusWeek 能表达主项目、副项目、维护项目和 off-focus 事件。
- 健康度有总状态和原因标签。
- 状态过旧阈值固定为 7 天。

风险：

- frontmatter 与正文 section 重复导致状态不一致。

控制方式：

- frontmatter 只保存核心机器字段，正文 section 保存人类可读管理内容。

## Phase 2：项目状态迁移

目标：把 active / watch 项目状态笔记统一为标准模板。

迁移范围：

| 项目 | lifecycle | 处理 |
|---|---|---|
| Kora | active | 迁移 |
| Pilot | 未显式 archived，按 active/watch 管理 | 迁移 |
| AI漫剧 | 未显式 archived，按 active/watch 管理 | 迁移 |
| comic-drama-pipeline | watch | 迁移 |
| AIDV | watch | 迁移 |
| 小桓子 | archived | 不动 |

迁移规则：

1. 严格重组，不只是在文件前面追加模板。
2. 能归类的内容进入标准 section。
3. 无法归类内容进入 `## 历史备注`。
4. 不删除信息。
5. 每个迁移文件保留迁移记录。
6. archived 项目不修改。

建议顺序：

1. 先迁移 Kora，作为样板。
2. Review 样板是否适合 Dashboard 解析。
3. 再迁移 Pilot、AI漫剧。
4. 最后迁移 watch 项目 comic-drama-pipeline、AIDV。

验收标准：

- 所有迁移范围内项目都包含标准 section。
- `.thirdspace/project-index.yaml` 中每个 active/watch 项目的 `status_note` 指向可解析文件。
- archived 小桓子没有 diff。

风险：

- 严格重组可能破坏原有阅读习惯。

控制方式：

- 每个项目迁移后用 git diff 人工审查；无法归类内容集中放 `历史备注`，不丢信息。

## Phase 3：本周 Focus

目标：建立单人创始人的注意力预算机制。

工作项：

1. 新增 `.thirdspace/focus-week.yaml`。
2. 新增周计划 Markdown 镜像。
3. 支持主项目 / 副项目 / 维护项目。
4. 支持 Focus Suggestions。
5. 支持 off-focus 原因记录。

核心规则：

- Focus 上限是 3。
- Focus 必须用户确认。
- 第 4 个项目进入 Focus 时采用中等约束：允许继续，但必须记录原因并提示替换。
- 非 Focus 项目加入 Today 时标记 off-focus。

验收标准：

- YAML 可机器读取。
- 周计划 Markdown 可人类回看。
- Focus role 不重复。
- off-focus event 有项目、日期、原因、目标位置。

风险：

- Focus 状态和周计划 Markdown 不一致。

控制方式：

- YAML 作为系统状态源，Markdown 作为可读镜像。

## Phase 4：Portfolio

目标：用 Portfolio 替换当前项目系统主界面。

新卡片：

| 卡片 | 作用 |
|---|---|
| Portfolio Health | 项目组合健康概览。 |
| Weekly Focus | 本周主 / 副 / 维护项目。 |
| Focus Suggestions | 系统推荐，用户确认。 |
| Priority Projects | P0 / P1 重点项目。 |
| Risk & Decision Queue | 风险、阻塞、待决策。 |
| Stale Status | 超过 7 天未更新项目。 |
| Delivery Gates | 交付门禁缺口。 |

降级卡片：

- Activity
- Workspaces
- Recent
- Materials
- Project Discovery
- Project Onboarding

这些进入 System 或二级区域，不再污染 PM 主视图。

主要代码区域：

- `src/view.ts`
- `src/data/vault-reader.ts`
- 可能新增 `src/data/project-management.ts`
- 可能新增 `src/components/portfolio-*`

验收标准：

- Portfolio 首屏能回答：哪些项目健康，哪些项目危险，哪些项目需要本周管理动作。
- 不再依赖 `04-项目/product-status.md` 作为主项目来源。
- 项目列表来自 `.thirdspace/project-index.yaml` 和标准项目状态笔记。

风险：

- 一次重构 `view.ts` 会使文件继续变大。

控制方式：

- 把 Portfolio 数据派生和渲染组件拆到独立模块。

## Phase 5：Project Detail

目标：让每个项目可展开理解和操作，而不是把所有信息塞进 Portfolio。

模块：

- Header
- Goal
- Success Criteria
- Milestone
- Next Step
- Risks
- Decisions
- Backlog
- Recent Outputs
- Context Readiness
- Quick Links

受控写入动作：

- 更新下一步。
- 新增风险。
- 标记风险解除。
- 新增待决策。
- 标记已决策。
- 加入 Today。

验收标准：

- 点击项目卡可打开详情抽屉或详情页。
- 所有写入只进入固定 section。
- Quick Links 能打开项目首页、状态笔记、Codex 上下文、资料索引、仓库路径。

风险：

- 在 Dashboard 中做过多编辑会变成完整编辑器。

控制方式：

- 只做结构化小动作，大段内容仍打开 Markdown 编辑。

## Phase 6：Today 升级

目标：让 Today 不只是 Todo 执行页，而是连接本周 Focus 的当日执行台。

新增或调整卡片：

| 卡片 | 作用 |
|---|---|
| Today Outcomes | 今天最多 3 个结果。 |
| Focus Projects | 今日是否覆盖本周主 / 副 / 维护项目。 |
| Commitments at Risk | 今日承诺风险。 |
| Decision Needed | 今日需要拍板。 |
| Next Action | 当前唯一下一步，优先考虑 Focus。 |
| Today Todos | 保持现有执行清单能力。 |
| Timeline / Outputs | 保持事实流能力。 |

验收标准：

- Today 能显示今天是否服务于本周 Focus。
- 非 Focus 项目进入 Today 时出现 off-focus 标记。
- Next Action 不被非 Focus 噪音轻易劫持。
- Today Todos 仍是唯一完整任务勾选清单。

风险：

- Today 和 Portfolio 重复展示项目管理信息。

控制方式：

- Today 只管当天执行；Portfolio 只管项目组合判断。

## Phase 7：Review / System 分离

目标：把复盘和系统维护从主 PM 页面中分离。

Review 第一版：

- 可先不做完整 UI。
- 生成或更新周计划 Markdown 的 `## 复盘`。
- 汇总 Focus 推进、产出、off-focus、风险、决策、下周建议。

System 第一版：

- 承接当前项目页里的维护卡片。
- 展示 Activity、Recent、Materials、Project Discovery、Project Onboarding、Data Health。

验收标准：

- Portfolio 不再被维护卡片占据。
- System 能找到原有维护能力。
- Review 能支撑周末判断继续、替换、暂停、归档。

风险：

- 页面数量增加导致导航复杂。

控制方式：

- 初期可以保留两个主 tab：Today / Portfolio；Review 和 System 从 Portfolio 的二级入口进入。

## Phase 8：验证、部署、复盘

目标：确保插件、Rain vault 文档和部署产物一致。

验证命令：

```bash
npm run build
cmp -s main.js /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js
cmp -s main.css /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css
git status --short --branch
```

手动验证：

- Obsidian 重新加载插件。
- 打开 Dashboard。
- 检查 Today。
- 检查 Portfolio。
- 检查 Project Detail。
- 检查 Focus 写入。
- 检查项目状态笔记没有丢内容。
- 检查 archived 小桓子无改动。

复盘问题：

1. 本周 Focus 是否真的减少了注意力分散？
2. Portfolio 是否能在 30 秒内告诉用户该管哪些项目？
3. Today 是否能避免被 off-focus 项目劫持？
4. 受控写入是否足够顺手且没有污染 Markdown？
5. 项目状态模板是否让 Codex/Kora 更容易接续上下文？

## 推荐首个实施批次

首个实施批次不要直接做完整 UI。推荐先做：

1. 标准项目状态模板。
2. Kora 项目状态样板迁移。
3. `.thirdspace/focus-week.yaml` 设计和读取。
4. Portfolio 数据派生函数。
5. Portfolio 只读版首屏。

这个批次能验证最核心假设：标准化项目状态 + 本周 Focus 是否能产生比当前项目页更好的 PM 判断。

