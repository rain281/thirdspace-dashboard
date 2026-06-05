# Next Action Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the today-page `OVERVIEW` card with a `NEXT ACTION` card that recommends exactly one current action.

**Architecture:** Keep the existing today-page grid and data loading. Add view-layer types and helpers in `src/view.ts` to calculate the next action from `TodayWorklog` and `ProjectBacklogItem[]`, then render a compact action card in the old overview slot. Add scoped CSS for `.ts-next-action-*` while preserving `.ts-overview-col` grid placement.

**Tech Stack:** Obsidian plugin API, TypeScript, CSS, esbuild.

---

### Task 1: Add Next Action Types And Calculation

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/view.ts`

- [ ] **Step 1: Add a `NextAction` interface below `TodayMetrics`**

```ts
interface NextAction {
  tone: "missing" | "warn" | "todo" | "pool" | "summary" | "idle";
  badge: string;
  title: string;
  reason: string;
  button: string;
  target: "today" | "project";
  projectItem?: ProjectBacklogItem;
  risks: string[];
}
```

- [ ] **Step 2: Add `calculateNextAction()` near `calculateTodayMetrics()`**

```ts
private calculateNextAction(today: TodayWorklog, missingLog: boolean, projectBacklog: ProjectBacklogItem[]): NextAction {
  const metrics = this.calculateTodayMetrics(today);
  const blocked = this.blockedTextsFromToday(today);
  const risks = this.nextActionRisks(today, metrics, blocked);
  const firstPending = today.todos.find(todo => !todo.done);

  if (missingLog) {
    return {
      tone: "missing",
      badge: "启动",
      title: "创建今天工作日志",
      reason: getTodayWorklogPath(),
      button: "创建",
      target: "today",
      risks,
    };
  }

  if (blocked.length > 0) {
    return {
      tone: "warn",
      badge: "阻塞",
      title: blocked[0],
      reason: `${blocked.length} 个条目包含 blocked / 阻塞 / 等待 / 卡住`,
      button: "打开",
      target: "today",
      risks,
    };
  }

  if (firstPending) {
    return {
      tone: "todo",
      badge: "今日Todo",
      title: firstPending.text,
      reason: `${metrics.pending} 个今日 Todo 待完成`,
      button: "打开",
      target: "today",
      risks,
    };
  }

  if (projectBacklog.length > 0) {
    const item = projectBacklog[0];
    return {
      tone: "pool",
      badge: item.project,
      title: item.text,
      reason: "今日 Todo 为空，可以从项目池拉入一项",
      button: "加入今日",
      target: "project",
      projectItem: item,
      risks,
    };
  }

  if (today.timeline.length > 0 && !this.todayHasOutput(today)) {
    return {
      tone: "summary",
      badge: "总结",
      title: "补写今日产出",
      reason: "今天已有记录，但还没有产出条目",
      button: "写总结",
      target: "today",
      risks,
    };
  }

  return {
    tone: "idle",
    badge: "启动",
    title: "设定今日重点",
    reason: "没有未完成 Todo 或项目池候选",
    button: "打开",
    target: "today",
    risks,
  };
}
```

- [ ] **Step 3: Add helper methods**

```ts
private blockedTextsFromToday(today: TodayWorklog): string[] {
  const values = [
    ...today.todos.map(todo => todo.text),
    ...today.timeline.flatMap(item => [item.title, item.subtitle ?? "", item.raw, ...item.body]),
  ];
  return values.filter(text => this.isBlockedText(text));
}

private todayHasOutput(today: TodayWorklog): boolean {
  return today.timeline.some(item => item.kind === "output");
}

private todayHasGit(today: TodayWorklog): boolean {
  return today.timeline.some(item => item.kind === "git");
}

private nextActionRisks(today: TodayWorklog, metrics: TodayMetrics, blocked: string[]): string[] {
  const risks: string[] = [];
  if (blocked.length > 0) risks.push(`${blocked.length} 阻塞`);
  if (metrics.pending >= 5) risks.push(`${metrics.pending} 待办`);
  if (!this.todayHasOutput(today)) risks.push("无产出");
  if (!this.todayHasGit(today)) risks.push("无 Git");
  return risks.slice(0, 3);
}
```

- [ ] **Step 4: Run TypeScript build check**

Run:

```bash
npm run build
```

Expected: PASS. This verifies the new strict TypeScript types before rendering is wired in.

### Task 2: Render The Card In The Overview Slot

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/view.ts`

- [ ] **Step 1: Replace the overview card body in `renderTodayPage()`**

Replace:

```ts
const overviewCard = overviewCol.createDiv({ cls: "ts-card ts-compact-card ts-overview-card" });
overviewCard.createDiv({ cls: "ts-card-label", text: "OVERVIEW" });
this.renderStatsRow(overviewCard, vaultStats, activity.filter(a=>a.count>0).length);
```

with:

```ts
const overviewCard = overviewCol.createDiv({ cls: "ts-card ts-compact-card ts-overview-card ts-next-action-card" });
this.renderNextAction(overviewCard, todayWorklog ?? this.emptyTodayWorklog(), !todayWorklog, projectBacklog);
```

- [ ] **Step 2: Remove unused parameters from `renderTodayPage()`**

Remove `vaultStats: VaultStats` and `activity: DailyActivity[]` from the `renderTodayPage()` signature, and update the caller from:

```ts
this.renderTodayPage(board, vaultStats, activity, todos, projectBacklog, todayWorklog);
```

to:

```ts
this.renderTodayPage(board, todos, projectBacklog, todayWorklog);
```

- [ ] **Step 3: Add `renderNextAction()` before `renderProjectBacklog()`**

```ts
private renderNextAction(
  parent: HTMLElement,
  today: TodayWorklog,
  missingLog: boolean,
  projectBacklog: ProjectBacklogItem[],
) {
  const action = this.calculateNextAction(today, missingLog, projectBacklog);
  const head = parent.createDiv({ cls: "ts-next-action-head" });
  head.createDiv({ cls: "ts-card-label", text: "NEXT ACTION" });
  head.createDiv({ cls: `ts-next-action-badge ts-next-action-badge--${action.tone}`, text: action.badge });

  const body = parent.createDiv({ cls: "ts-next-action-body" });
  body.createDiv({ cls: "ts-next-action-title", text: action.title });
  body.createDiv({ cls: "ts-next-action-reason", text: action.reason });

  const foot = parent.createDiv({ cls: "ts-next-action-foot" });
  const riskRow = foot.createDiv({ cls: "ts-next-action-risks" });
  if (action.risks.length === 0) {
    riskRow.createSpan({ cls: "ts-next-action-risk ts-next-action-risk--quiet", text: "状态正常" });
  } else {
    for (const risk of action.risks) riskRow.createSpan({ cls: "ts-next-action-risk", text: risk });
  }

  const button = foot.createEl("button", { cls: `ts-next-action-btn ts-next-action-btn--${action.tone}`, text: action.button });
  button.addEventListener("click", async e => {
    e.stopPropagation();
    await this.runNextAction(action, button);
  });

  parent.addEventListener("click", () => {
    if (action.target === "project" && action.projectItem) this.openFile(action.projectItem.path);
    else void this.openTodayLog();
  });
}
```

- [ ] **Step 4: Add `runNextAction()`**

```ts
private async runNextAction(action: NextAction, button: HTMLButtonElement) {
  if (action.target === "project" && action.projectItem) {
    button.disabled = true;
    button.setText("加入中");
    await promoteProjectBacklogItemToToday(this.app, action.projectItem);
    new Notice(`${action.projectItem.project} 已加入今日 Todo`);
    await this.render();
    return;
  }
  await this.openTodayLog();
}
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS. Confirm `OVERVIEW` no longer appears in `src/view.ts` rendered label path.

### Task 3: Style The Next Action Card

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/styles.css`

- [ ] **Step 1: Add base card styles near the card section**

```css
.ts-next-action-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ts-next-action-head,
.ts-next-action-foot {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ts-next-action-head .ts-card-label {
  margin-bottom: 0;
}
```

- [ ] **Step 2: Add badge, body, and risk styles**

```css
.ts-next-action-badge {
  max-width: 92px;
  overflow: hidden;
  padding: 2px 7px;
  border: 1px solid var(--ts-border);
  border-radius: 999px;
  color: var(--ts-text-2);
  font-size: 9px;
  line-height: 1.2;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-next-action-badge--warn {
  border-color: color-mix(in srgb, var(--ts-yellow) 48%, var(--ts-border) 52%);
  color: color-mix(in srgb, var(--ts-yellow) 78%, var(--ts-text) 22%);
}

.ts-next-action-badge--todo,
.ts-next-action-badge--pool {
  border-color: color-mix(in srgb, var(--ts-accent) 34%, var(--ts-border) 66%);
}

.ts-next-action-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ts-next-action-title {
  min-width: 0;
  overflow: hidden;
  color: var(--ts-text);
  font-size: 12.5px;
  line-height: 1.2;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-next-action-reason {
  min-width: 0;
  overflow: hidden;
  color: var(--ts-text-3);
  font-size: 10px;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-next-action-risks {
  min-width: 0;
  display: flex;
  gap: 4px;
  overflow: hidden;
}

.ts-next-action-risk {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  padding: 1px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ts-yellow) 10%, var(--background-primary) 90%);
  color: var(--ts-text-3);
  font-size: 8.5px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-next-action-risk--quiet {
  background: color-mix(in srgb, var(--ts-green) 9%, var(--background-primary) 91%);
}
```

- [ ] **Step 3: Add button styles**

```css
.ts-next-action-btn {
  appearance: none;
  flex: 0 0 auto;
  min-width: 58px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--ts-accent) 36%, var(--ts-border) 64%);
  border-radius: var(--ts-radius-sm);
  background: color-mix(in srgb, var(--ts-accent) 10%, var(--background-primary) 90%);
  box-shadow: none;
  color: var(--ts-text);
  font-family: var(--ts-font);
  font-size: 10px;
  line-height: 1;
  font-weight: 800;
  cursor: pointer;
}

.ts-next-action-btn:hover {
  border-color: var(--ts-accent);
  background: color-mix(in srgb, var(--ts-accent) 16%, var(--background-primary) 84%);
}

.ts-next-action-btn:disabled {
  cursor: wait;
  opacity: .72;
}

.ts-next-action-btn--warn {
  border-color: color-mix(in srgb, var(--ts-yellow) 48%, var(--ts-border) 52%);
  background: color-mix(in srgb, var(--ts-yellow) 10%, var(--background-primary) 90%);
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS. CSS is bundled into `main.css`.

### Task 4: Deploy, Verify, Log, And Push

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/02-日记/工作日志/20260605_工作日志_周五.md`

- [ ] **Step 1: Build dashboard**

Run:

```bash
npm run build
```

Expected: TypeScript and esbuild complete successfully.

- [ ] **Step 2: Deploy Rain plugin files**

Run:

```bash
cp /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js
cp /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css
cmp -s /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js
cmp -s /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css
```

Expected: both `cmp -s` commands exit 0, so deployment consistency is 2真实/2总数.

- [ ] **Step 3: Restart Obsidian**

Run:

```bash
osascript -e 'tell application id "md.obsidian" to quit' >/dev/null 2>&1 || true
for i in {1..20}; do
  if ! pgrep -x Obsidian >/dev/null 2>&1; then break; fi
  sleep 0.5
done
open -b md.obsidian
```

Expected: Obsidian quits and reopens.

- [ ] **Step 4: Update Rain worklog**

Add a `重点记录` entry, a `今日产出` item, and an `Agent 产出` item for `NEXT ACTION` implementation. Include build 1真实/1总数 and deployment 2真实/2总数 verification.

- [ ] **Step 5: Commit dashboard and Rain**

Run:

```bash
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard add src/view.ts src/styles.css main.js main.css docs/superpowers/plans/2026-06-05-next-action-card.md
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard commit -m "feat: add next action card"
git -C /Volumes/资料/projects/thirdspace/rain add .obsidian/plugins/thirdspace-dashboard/main.js .obsidian/plugins/thirdspace-dashboard/styles.css 02-日记/工作日志/20260605_工作日志_周五.md
git -C /Volumes/资料/projects/thirdspace/rain commit -m "feat: deploy next action card"
```

If the Rain Git hook appends a `## Git 提交` entry after commit, run:

```bash
git -C /Volumes/资料/projects/thirdspace/rain add 02-日记/工作日志/20260605_工作日志_周五.md
git -C /Volumes/资料/projects/thirdspace/rain -c core.hooksPath=/dev/null commit -m "docs: record next action card commit"
```

- [ ] **Step 6: Push and final status**

Run:

```bash
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard push
git -C /Volumes/资料/projects/thirdspace/rain push
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard status --short --branch
git -C /Volumes/资料/projects/thirdspace/rain status --short --branch
git -C /Volumes/资料/projects/Kora status --short --branch
```

Expected: 3真实/3总数 repositories are clean and synced.
